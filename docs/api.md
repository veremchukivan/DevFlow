# DevFlow API

Base URL for local development:

```txt
http://localhost:4000
```

The API uses cookie-based sessions. After `register` or `login`, keep the
`devflow_session` cookie and send it on authenticated requests.

## Roles

Workspace roles are ordered by access level:

```txt
owner > admin > member > viewer
```

Current permission rules:

| Permission | owner | admin | member | viewer |
| --- | --- | --- | --- | --- |
| Read workspace data | yes | yes | yes | yes |
| Create projects | yes | yes | no | no |
| Create tasks | yes | yes | yes | no |
| Update tasks | yes | yes | yes | no |
| Delete tasks | yes | yes | no | no |
| Create comments | yes | yes | yes | no |
| Update own comments | yes | yes | yes | no |
| Update any comment | yes | yes | no | no |
| Manage members | yes | yes | no | no |
| Manage invitations | yes | yes | no | no |

## Errors

Errors use a stable code and message:

```json
{
  "error": {
    "code": "UNAUTHENTICATED",
    "message": "Authentication is required"
  }
}
```

## Auth

Register:

```http
POST /api/v1/auth/register
Content-Type: application/json
```

```json
{
  "displayName": "Alice Tester",
  "email": "alice.tester@example.com",
  "password": "Password123"
}
```

Login:

```http
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{
  "email": "alice.tester@example.com",
  "password": "Password123"
}
```

Current user:

```http
GET /api/v1/auth/me
```

Logout:

```http
POST /api/v1/auth/logout
```

## Workspaces

Create workspace:

```http
POST /api/v1/workspaces
Content-Type: application/json
```

```json
{
  "name": "Acme Product",
  "slug": "acme-product"
}
```

List workspaces:

```http
GET /api/v1/workspaces
```

Get workspace:

```http
GET /api/v1/workspaces/:workspaceId
```

## Members

List members:

```http
GET /api/v1/workspaces/:workspaceId/members
```

Add an existing user to a workspace:

```http
POST /api/v1/workspaces/:workspaceId/members
Content-Type: application/json
```

```json
{
  "email": "bob@example.com",
  "role": "member"
}
```

Update member role or status:

```http
PATCH /api/v1/workspaces/:workspaceId/members/:userId
Content-Type: application/json
```

```json
{
  "role": "viewer",
  "status": "active"
}
```

Remove member:

```http
DELETE /api/v1/workspaces/:workspaceId/members/:userId
```

## Invitations

Create invitation:

```http
POST /api/v1/workspaces/:workspaceId/invitations
Content-Type: application/json
```

```json
{
  "email": "new.member@example.com",
  "role": "member"
}
```

Only development and test responses include the raw invitation `token`, so the
flow can be tested without email delivery. Production responses never expose
the token; configure an email delivery provider before enabling invitations in
production.

List pending invitations:

```http
GET /api/v1/workspaces/:workspaceId/invitations
```

Inspect public invitation:

```http
GET /api/v1/invitations/:token
```

Accept invitation:

```http
POST /api/v1/invitations/:token/accept
```

Decline invitation:

```http
POST /api/v1/invitations/:token/decline
```

Cancel invitation:

```http
DELETE /api/v1/workspaces/:workspaceId/invitations/:invitationId
```

Resend invitation:

```http
POST /api/v1/workspaces/:workspaceId/invitations/:invitationId/resend
```

## Projects

Create project:

```http
POST /api/v1/workspaces/:workspaceId/projects
Content-Type: application/json
```

```json
{
  "key": "WEB",
  "name": "Website Redesign",
  "description": "Customer-facing web app"
}
```

List projects:

```http
GET /api/v1/workspaces/:workspaceId/projects
```

Get project:

```http
GET /api/v1/workspaces/:workspaceId/projects/:projectId
```

## Tasks

Create task:

```http
POST /api/v1/workspaces/:workspaceId/projects/:projectId/tasks
Content-Type: application/json
```

```json
{
  "title": "Design login form",
  "description": "Create the first auth screen",
  "priority": "high"
}
```

List tasks:

```http
GET /api/v1/workspaces/:workspaceId/projects/:projectId/tasks
```

Available task filters:

```txt
statusId=<uuid>
priority=low|medium|high|urgent
assigneeUserId=<uuid>|none
search=<text>
archived=true|false
sortBy=createdAt|updatedAt|priority|number
sortOrder=asc|desc
```

Example:

```http
GET /api/v1/workspaces/:workspaceId/projects/:projectId/tasks?priority=high&sortBy=number&sortOrder=asc
```

Update task:

```http
PATCH /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId
Content-Type: application/json
```

```json
{
  "title": "Design login and register forms",
  "priority": "urgent"
}
```

Archive task:

```http
DELETE /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId
```

## Comments

Create comment:

```http
POST /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments
Content-Type: application/json
```

```json
{
  "body": "I pushed the first draft."
}
```

List comments:

```http
GET /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments
```

Update comment:

```http
PATCH /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments/:commentId
```

Delete comment:

```http
DELETE /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments/:commentId
```

## Activity

List task activity:

```http
GET /api/v1/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/activity
```
