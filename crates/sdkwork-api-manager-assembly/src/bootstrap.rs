//! Authored API assembly bootstrap for sdkwork-manager.
//!
//! The assembly exports the indivisible `ApiAssemblyContribution` contract
//! (API_ASSEMBLY_SPEC.md section 4); the platform cloud gateway composes the
//! contribution with its process-shared PostgreSQL pool.

use axum::Router;
use sdkwork_database_sqlx::DatabasePool;
use sdkwork_manager_service_host::ManagerServiceHost;
use sdkwork_web_bootstrap::{ApiAssemblyContribution, DatabasePoolReadinessCheck, WebModule};
use sdkwork_web_core::HttpRouteManifest;
use std::sync::Arc;

/// Indivisible host-neutral API assembly contribution (web-bootstrap contract).
pub type ApiAssembly = ApiAssemblyContribution;

/// Owner-managed runtime state retained by the standalone host.
pub struct ManagerApiRuntime {
    pub contribution: ApiAssembly,
    pub database_pool: DatabasePool,
}

fn combined_route_manifest() -> HttpRouteManifest {
    let manifests = [
        sdkwork_routes_manager_app_api::gateway_route_manifest(),
        sdkwork_routes_manager_backend_api::gateway_route_manifest(),
    ];
    HttpRouteManifest::from_owned_routes(
        manifests
            .into_iter()
            .flat_map(|manifest| manifest.routes().to_vec())
            .collect(),
    )
}

pub async fn assemble_api_router(host: Arc<ManagerServiceHost>) -> Result<ApiAssembly, String> {
    let router = Router::new()
        .merge(sdkwork_routes_manager_app_api::gateway_mount(host.clone()).await)
        .merge(sdkwork_routes_manager_backend_api::gateway_mount(host).await);
    ApiAssemblyContribution::from_manifest(
        "sdkwork-manager",
        "SDKWork Manager API",
        router,
        combined_route_manifest(),
        Vec::new(),
        Arc::new(sdkwork_web_bootstrap::AlwaysReady),
    )
}

/// Assemble the manager application router from environment variables.
pub async fn assemble_business_routes_from_env() -> Result<ApiAssembly, String> {
    let host = Arc::new(ManagerServiceHost::from_env().await?);
    assemble_api_router(host).await
}

/// Builds the canonical Manager owner contribution and exposes the process pool
/// that the final host passes to explicitly selected dependency assemblies.
pub async fn assemble_api_runtime_from_env() -> Result<ManagerApiRuntime, String> {
    let host = Arc::new(ManagerServiceHost::from_env().await?);
    let database_pool = host.database_pool().clone();
    let contribution = assemble_api_router(host).await?;
    Ok(ManagerApiRuntime {
        contribution,
        database_pool,
    })
}

/// Assemble the Manager contribution against a caller-provided database pool so
/// the platform cloud gateway can share its process-wide PostgreSQL pool.
///
/// Only manager-owned routes are mounted; the cloud gateway hosts the
/// dependency-owned IAM, Drive, Order, Promotion, Payment, and Membership
/// surfaces as separate contributions.
pub async fn assemble_api_router_with_pool(pool: DatabasePool) -> Result<ApiAssembly, String> {
    let host = Arc::new(ManagerServiceHost::from_database_pool(pool.clone()).await?);
    let mut router = Router::new();
    router = router.merge(sdkwork_routes_manager_app_api::gateway_mount(host.clone()).await);
    router = router.merge(sdkwork_routes_manager_backend_api::gateway_mount(host).await);
    ApiAssemblyContribution::from_manifest(
        "sdkwork-manager",
        "SDKWork Manager API",
        router,
        combined_route_manifest(),
        Vec::new(),
        Arc::new(DatabasePoolReadinessCheck::new(pool)),
    )
}

/// Same as [`web_module`] but composed on a process-shared database pool
/// (platform gateways, API_ASSEMBLY_SPEC §4.1.1).
pub async fn web_module_with_pool(pool: DatabasePool) -> Result<WebModule, String> {
    Ok(WebModule::from_contribution(assemble_api_router_with_pool(pool).await?))
}

/// Canonical Web Module definition for this application
/// (API_ASSEMBLY_SPEC §4.1.1): the complete HTTP surface — every route,
/// manifest, and OpenAPI document of this owner — as one installable module.
pub async fn web_module() -> Result<WebModule, String> {
    Ok(WebModule::from_contribution(assemble_business_routes_from_env().await?))
}
