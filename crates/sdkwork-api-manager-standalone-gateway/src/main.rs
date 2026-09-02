use std::sync::Arc;

use sdkwork_api_manager_assembly::assemble_api_runtime_from_env;
use sdkwork_iam_web_adapter::{
    build_web_framework_builder, iam_web_request_context_resolver_from_database_pool_for_audiences,
    iam_web_request_context_resolver_from_env, IamAuditEmitter, IamSecurityEventEmitter,
};
use sdkwork_web_bootstrap::{ApiModuleRegistry, ComposedApiAssembly, infra_public_path_prefixes};

const APPLICATION_ID: &str = "sdkwork-manager";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    host_gateway().await
}

async fn host_gateway() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt::init();
    tracing::info!("Starting SDKWork Manager API Server...");

    sdkwork_database_sqlx::enable_process_shared_database_pool();

    let manager_runtime = assemble_api_runtime_from_env().await?;
    let database_pool = manager_runtime.database_pool;
    let postgres_pool = database_pool
        .as_postgres()
        .cloned()
        .ok_or("Manager standalone gateway requires PostgreSQL")?;
    let iam =
        sdkwork_api_iam_assembly::assemble_owner_api_surfaces_with_pool(database_pool.clone())
            .await?;
    tracing::info!("Manager IAM tenant application bootstrap completed");

    if std::env::var_os("SDKWORK_MANAGER_BOOTSTRAP_ONLY").is_some() {
        tracing::info!("SDKWORK_MANAGER_BOOTSTRAP_ONLY is set; exiting after IAM bootstrap");
        return Ok(());
    }

    let drive = sdkwork_api_drive_assembly::assemble_api_router(postgres_pool.clone()).await?;
    let order =
        sdkwork_api_order_assembly::assemble_api_router_with_pool(database_pool.clone()).await?;
    let promotion =
        sdkwork_api_promotion_assembly::assemble_api_router_with_pool(database_pool.clone())
            .await?;
    let payment =
        sdkwork_api_payment_assembly::assemble_api_router_with_pool(database_pool.clone()).await?;
    let membership =
        sdkwork_api_membership_assembly::assemble_api_router_with_pool(database_pool.clone())
            .await?;
    let contributions = vec![
        manager_runtime.contribution,
        iam,
        drive,
        order,
        promotion,
        payment,
        membership,
    ];
    let mut module_registry = ApiModuleRegistry::new();
    module_registry.add_modules(contributions);
    let composed = module_registry
        .try_compose("SDKWork Manager API")?;
    let environment = std::env::var("SDKWORK_ENVIRONMENT")
        .or_else(|_| std::env::var("SDKWORK_MANAGER_ENVIRONMENT"))
        .unwrap_or_else(|_| "development".to_owned());
    let production = matches!(
        environment.trim().to_ascii_lowercase().as_str(),
        "prod" | "production"
    );
    let resolver = if production {
        iam_web_request_context_resolver_from_database_pool_for_audiences(
            database_pool,
            &[APPLICATION_ID, "manager"],
        )
        .await?
    } else {
        iam_web_request_context_resolver_from_env().await
    };
    let (_, security_policy) = sdkwork_web_bootstrap::application_security_policy_from_env(
        &["SDKWORK_MANAGER_ENVIRONMENT", "SDKWORK_ENVIRONMENT"],
        &[
            "SDKWORK_MANAGER_CORS_ALLOWED_ORIGINS",
            "SDKWORK_CORS_ALLOWED_ORIGINS",
        ],
    );
    let mut framework = build_web_framework_builder(
        resolver,
        composed.route_manifest.clone(),
        infra_public_path_prefixes(),
    )
    .security_policy(security_policy);
    if production {
        framework = framework
            .audit_emitter(Arc::new(IamAuditEmitter::new(
                postgres_pool.clone(),
                APPLICATION_ID,
                environment.clone(),
            )))
            .security_event_emitter(Arc::new(IamSecurityEventEmitter::new(
                postgres_pool,
                environment,
            )));
    }
    let app = composed.into_hosted(framework).router;

    let addr = std::env::var("SDKWORK_MANAGER_APPLICATION_PUBLIC_INGRESS_BIND")
        .or_else(|_| std::env::var("MANAGER_API_BIND"))
        .unwrap_or_else(|_| "127.0.0.1:18092".to_owned());
    tracing::info!("Manager API server listening on {addr}");
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("bind manager server");
    axum::serve(listener, app)
        .await
        .map_err(|error| format!("serve manager server: {error}"))?;
    Ok(())
}
