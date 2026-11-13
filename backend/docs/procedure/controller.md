# ProcedureController

**Module:** `ProcedureModule` (`backend/src/modules/procedure`)  
**Base Path:** `/procedures`  
**Guards:** `JwtAuthGuard`, `RolesGuard`  
**Roles:** `ADMIN`, `SUPER_ADMIN` for mutation endpoints; `USER` can query published procedures and version details.

---

## 1. Endpoints

| Method | Path | Roles | Description |
|---|---|---|---|
| `GET` | `/procedures` | All Authenticated | Paginated procedures list. Regular users see published procedures only. |
| `POST` | `/procedures` | `ADMIN`, `SUPER_ADMIN` | Create new procedure and initialize draft v1. |
| `GET` | `/procedures/:id` | All Authenticated | Get procedure details with active version. |
| `PATCH` | `/procedures/:id` | `ADMIN`, `SUPER_ADMIN` | Update procedure metadata. |
| `DELETE` | `/procedures/:id` | `ADMIN`, `SUPER_ADMIN` | Delete procedure and versions. |
| `GET` | `/procedures/:id/versions` | `ADMIN`, `SUPER_ADMIN` | List all versions of a procedure. |
| `POST` | `/procedures/:id/draft` | `ADMIN`, `SUPER_ADMIN` | Clone latest/active version into new draft. |
| `GET` | `/procedures/versions/:versionId` | All Authenticated | Get complete configuration details of a version. |
| `PUT` | `/procedures/versions/:versionId` | `ADMIN`, `SUPER_ADMIN` | Save draft configuration (mappings). |
| `POST` | `/procedures/versions/:versionId/validate` | `ADMIN`, `SUPER_ADMIN` | Validate draft configuration without state change. |
| `POST` | `/procedures/versions/:versionId/publish` | `ADMIN`, `SUPER_ADMIN` | Publish version with version pinning (ADR-005). |
| `GET` | `/procedures/helpers/directory` | `ADMIN`, `SUPER_ADMIN` | Active users with department and title. |
| `GET` | `/procedures/helpers/forms` | `ADMIN`, `SUPER_ADMIN` | Available forms and latest versions. |
| `GET` | `/procedures/helpers/workflows` | `ADMIN`, `SUPER_ADMIN` | Deployed Operaton workflows in `category="e-Office"`. |

