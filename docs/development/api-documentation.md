# API Documentation Generation

This guide explains how to generate and maintain API documentation for Finito Mail.

## Overview

We use a hybrid approach for API documentation:
- **TypeScript types** for type safety and IntelliSense
- **JSDoc comments** for inline documentation
- **OpenAPI/Swagger** for REST API specification
- **Automated generation** to keep docs in sync with code

## Current API Documentation

### Manual Documentation
Currently maintained manually in:
- [`/docs/api/REST_API.md`](../api/REST_API.md) - REST endpoints
- [`/docs/api/WEBHOOKS.md`](../api/WEBHOOKS.md) - Webhook handlers
- [`/docs/api/RATE_LIMITS.md`](../api/RATE_LIMITS.md) - Rate limiting

### Inline Documentation
All API routes include JSDoc comments:

```typescript
/**
 * Sync emails for the authenticated user
 * @route POST /api/emails/sync
 * @param {SyncRequest} request.body - Sync configuration
 * @returns {SyncResponse} 200 - Sync status
 * @returns {Error} 401 - Unauthorized
 * @returns {Error} 429 - Rate limit exceeded
 */
export async function POST(request: Request) {
  // Implementation
}
```

## Setting Up API Documentation Generation

### 1. Install Dependencies

```bash
npm install --save-dev @apidevtools/swagger-parser swagger-jsdoc swagger-ui-react
npm install --save-dev @types/swagger-jsdoc @types/swagger-ui-react
```

### 2. Configure OpenAPI Generation

Create `scripts/generate-openapi.js`:

```javascript
const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Finito Mail API',
      version: '1.0.0',
      description: 'REST API for Finito Mail email client',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.finito-mail.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'session',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
  },
  apis: [
    './apps/web/src/app/api/**/*.ts',
    './apps/api/app/api/**/*.ts',
  ],
};

const spec = swaggerJsdoc(options);

// Write to file
fs.writeFileSync(
  path.join(__dirname, '../docs/api/openapi.json'),
  JSON.stringify(spec, null, 2)
);

console.log('OpenAPI specification generated successfully!');
```

### 3. Add Generation Script

Update `package.json`:

```json
{
  "scripts": {
    "docs:api": "node scripts/generate-openapi.js",
    "docs:api:watch": "nodemon --watch 'apps/*/src/app/api/**/*.ts' --exec 'npm run docs:api'"
  }
}
```

### 4. Create API Documentation Page

Create `docs/api/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Finito Mail API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "./openapi.json",
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    }
  </script>
</body>
</html>
```

## Writing API Documentation

### Route Documentation Format

```typescript
/**
 * @swagger
 * /api/emails:
 *   get:
 *     summary: List emails
 *     description: Retrieve a paginated list of emails for the authenticated user
 *     tags: [Emails]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of emails
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 emails:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Email'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         description: Unauthorized
 */
export async function GET(request: Request) {
  // Implementation
}
```

### Schema Documentation

```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     Email:
 *       type: object
 *       required:
 *         - id
 *         - subject
 *         - from
 *         - date
 *       properties:
 *         id:
 *           type: string
 *           description: Unique email identifier
 *         subject:
 *           type: string
 *           description: Email subject line
 *         from:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               format: email
 *             name:
 *               type: string
 *         date:
 *           type: string
 *           format: date-time
 *         body:
 *           type: string
 *           description: Email body content
 */
```

## Best Practices

### 1. Consistent Documentation
- Document all public API endpoints
- Include request/response examples
- Document error responses
- Keep descriptions clear and concise

### 2. Type Safety
- Use TypeScript interfaces for all API types
- Export types for client consumption
- Validate against schemas in tests

### 3. Versioning
- Include version in API path (`/api/v1/`)
- Document breaking changes
- Maintain backward compatibility

### 4. Examples
Always include usage examples:

```typescript
/**
 * @example
 * // Request
 * POST /api/emails/sync
 * {
 *   "fullSync": false,
 *   "pageToken": "xyz123"
 * }
 * 
 * // Response
 * {
 *   "synced": 150,
 *   "nextPageToken": "abc456",
 *   "hasMore": true
 * }
 */
```

## Automation

### CI/CD Integration

Add to `.github/workflows/docs.yml`:

```yaml
name: Generate API Docs

on:
  push:
    paths:
      - 'apps/*/src/app/api/**/*.ts'
      - 'scripts/generate-openapi.js'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
          
      - name: Install dependencies
        run: npm ci
        
      - name: Generate API docs
        run: npm run docs:api
        
      - name: Commit changes
        uses: EndBug/add-and-commit@v9
        with:
          add: 'docs/api/openapi.json'
          message: 'docs: update API documentation'
```

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Generate API docs if API files changed
if git diff --cached --name-only | grep -q "api/.*\.ts$"; then
  npm run docs:api
  git add docs/api/openapi.json
fi
```

## Viewing Documentation

### Local Development
```bash
# Generate docs
npm run docs:api

# Serve docs (install http-server globally first)
cd docs/api && http-server -p 8080

# Open http://localhost:8080
```

### Production
Deploy the `docs/api` directory to your documentation site.

## Future Enhancements

1. **GraphQL Support** - Add GraphQL schema documentation
2. **SDK Generation** - Auto-generate client SDKs
3. **Postman Collection** - Export to Postman format
4. **API Changelog** - Track API changes over time
5. **Interactive Console** - Try API calls directly from docs

## Troubleshooting

### Documentation Not Generating
- Check JSDoc syntax is correct
- Verify file paths in configuration
- Ensure TypeScript compiles without errors

### Missing Endpoints
- Add `@swagger` tag to route handlers
- Check glob patterns include all API files
- Verify exports are named correctly

### Schema Validation Errors
- Ensure all referenced schemas exist
- Check for circular dependencies
- Validate OpenAPI spec online