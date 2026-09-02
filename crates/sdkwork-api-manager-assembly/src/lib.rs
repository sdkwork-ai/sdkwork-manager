//! API assembly for sdkwork-manager.
//! Application bootstrap lives in `bootstrap.rs`; route inventory is in `assembly-manifest.json`.
//! SDKWORK-ASSEMBLY-LIB-CUSTOM: exports beyond the canonical materializer template.

mod bootstrap;
mod generated;

pub use bootstrap::{assemble_api_router, ApiAssembly, assemble_api_router_with_pool, assemble_api_runtime_from_env, assemble_business_routes_from_env, ManagerApiRuntime, web_module, web_module_with_pool};

pub fn assembly_route_count() -> usize {
    generated::ROUTE_CRATE_COUNT
}
