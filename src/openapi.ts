type Method = 'get' | 'post' | 'put' | 'delete';
type Route = [Method, string, string, string?, string?];

const routes: Route[] = [
  ['get','/api/openapi.json','OpenAPI specification as JSON','Public'],['get','/api/openapi.yaml','OpenAPI specification as YAML','Public'],
  ['get','/health','Health and database readiness','Public'],['get','/api/health','Health and database readiness','Public'],
  ['post','/api/auth/register','Register a user','JWT + users permission','username,password,email?'],['post','/api/auth/login','Authenticate and issue JWT/cookie','Public','username,password'],['post','/api/auth/2fa/complete','Complete two-factor login','Public','tempToken,code'],['post','/api/auth/logout','Clear authentication cookie','Public'],['get','/api/auth/me','Get current user','JWT or API key'],['post','/api/auth/2fa/setup','Create 2FA enrollment','JWT',''],['post','/api/auth/2fa/verify','Verify 2FA enrollment','JWT','code'],['post','/api/auth/2fa/disable','Disable 2FA','JWT','code'],
  ['get','/api/users','List users','JWT + users permission'],['put','/api/users/{id}','Update user','JWT + users permission','username?,email?,role?,password?'],['delete','/api/users/{id}','Delete user','JWT + users permission'],['get','/api/permissions','List permissions','Admin'],['get','/api/roles/options','List role options','JWT + users permission'],['get','/api/roles','List roles','Admin'],['post','/api/roles','Create role','Admin','name,description?,permissions?'],['put','/api/roles/{id}','Update role','Admin','name?,description?,permissions?'],['delete','/api/roles/{id}','Delete role','Admin'],
  ['get','/api/products','List/search products','JWT/API key + products permission','Query: page,pageSize,search,q'],['post','/api/products','Create or upsert product','JWT/API key + products permission','sku,name,category?,quantity?'],['get','/api/products/{sku}','Get product','JWT/API key + products permission'],['put','/api/products/{sku}','Update product','JWT/API key + products permission','name,category?,quantity?'],['delete','/api/products/{sku}','Delete product','Admin'],['post','/api/products/{sku}/archive','Archive product','JWT/API key + products permission'],['get','/api/products/{sku}/history','List location history','JWT/API key + products permission','Query: page,pageSize'],['post','/api/inventory/movement','Record inventory movement','JWT/API key + products permission','sku,type(IN|OUT),quantity,note?'],
  ['get','/api/employees','List employees','JWT/API key + employees permission'],['post','/api/employees','Create employee','JWT/API key + employees permission','name,position?,email?'],['get','/api/employees/{id}','Get employee','JWT/API key + employees permission'],['delete','/api/employees/{id}','Delete employee','Admin'],['post','/api/employees/import','Import employees from spreadsheet','Admin','multipart file'],['get','/api/employees/{id}/constancias','List employee certificates','JWT/API key + employees permission'],['post','/api/employees/{id}/constancias','Upload certificate','JWT/API key + employees permission','multipart title,description?,file?'],['delete','/api/constancias/{id}','Delete certificate and file','Admin'],
  ['get','/api/papeleria/orders','List orders (users: own; admin: all)','JWT/API key + papeleria permission','Query: limit'],['post','/api/papeleria/orders','Create order','JWT/API key + papeleria permission','items[{itemId,quantity,note?}]'],['get','/api/papeleria/orders/{id}','Get order','JWT/API key + papeleria permission (ownership enforced)'],['put','/api/papeleria/orders/{id}','Update open order','Admin','items?'],['post','/api/papeleria/orders/{id}/close','Close order','Admin'],['get','/api/papeleria','List stationery items','JWT/API key + papeleria permission'],['post','/api/papeleria','Create stationery item','Admin','name,unit?,quantity?'],['put','/api/papeleria/{id}','Update stationery item','Admin','name?,unit?,quantity?'],['delete','/api/papeleria/{id}','Delete stationery item','Admin'],['post','/api/papeleria/import','Import stationery spreadsheet','Admin','multipart file'],
  ['get','/api/settings','Read settings','JWT/API key + settings permission'],['put','/api/settings','Update setting','JWT/API key + settings permission','key,value'],['get','/api/settings/api-key','Read API key status','Admin'],['post','/api/settings/api-key','Generate API key (returned once)','Admin'],['delete','/api/settings/api-key','Revoke API key','Admin'],['put','/api/settings/api-enabled','Enable or disable API key','Admin','enabled'],['get','/api/backup','Export backup; includeSensitive=true includes credentials','Admin','Query: includeSensitive'],['post','/api/backup/restore','Restore sensitive backup','Admin','Backup JSON'],['get','/api/audit-logs','List audit logs','Admin','Query: page,pageSize,search'],
];

const error = (description: string) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } });
const accessFor = (auth: string) => {
  if (auth === 'Public') return { security: undefined, xAccess: { public: true } };
  const permission = auth.match(/(users|products|employees|papeleria|settings) permission/)?.[1];
  const admin = auth.includes('Admin');
  return { security: [{ bearerAuth: [] }, { cookieAuth: [] }, { apiKey: [] }], xAccess: admin ? { admin: true } : permission ? { permission } : { authenticated: true } };
};
const paths: Record<string, Record<string, unknown>> = {};
const objectSchema = (properties: Record<string, unknown>, required: string[] = Object.keys(properties)) => ({ type: 'object', properties, required });
const string = { type: 'string' };
const successSchema = (path: string, method: Method) => {
  if (path.endsWith('.json')) return { type: 'object', properties: { openapi: string, info: objectSchema({ title: string, version: string }), paths: { type: 'object' } }, required: ['openapi', 'info', 'paths'] };
  if (path.endsWith('.yaml')) return string;
  if (path === '/health' || path === '/api/health') return objectSchema({ status: string, database: string });
  if (path === '/api/backup' && method === 'get') return objectSchema({ version: string, data: { type: 'object' } }, ['version', 'data']);
  if (path === '/api/auth/logout' || path.includes('/2fa/verify') || path.includes('/2fa/disable')) return objectSchema({ ok: { type: 'boolean' } });
  if (path === '/api/auth/2fa/complete' || path === '/api/auth/login' || path === '/api/auth/register') return objectSchema({ token: string, user: { type: 'object' } }, ['token', 'user']);
  if (method === 'get' && !path.includes('{') && path !== '/api/auth/me' && path !== '/api/settings/api-key') return { type: 'array', items: { type: 'object', additionalProperties: true } };
  if (path.includes('/import')) return objectSchema({ imported: { type: 'integer' } }, ['imported']);
  if (path === '/api/backup/restore') return objectSchema({ message: string });
  if (path === '/api/settings/api-key' && method === 'get') return objectSchema({ configured: { type: 'boolean' } });
  if (path === '/api/settings/api-key' && method === 'delete') return objectSchema({ message: string });
  return objectSchema({ id: string, message: string }, ['id']);
};
for (const [method, path, summary, auth = 'JWT', body] of routes) {
  const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map(([_, name]) => ({ name, in: 'path', required: true, schema: { type: 'string' } }));
  if (body?.startsWith('Query:')) for (const name of body.slice(7).split(',')) parameters.push({ name, in: 'query', required: false, schema: { type: 'string' } });
  let requestSchema: Record<string, unknown> | undefined;
  if (body && !body.startsWith('Query:')) {
    const multipart = body.startsWith('multipart');
    const fieldList = body.replace(/^multipart\s*/, '');
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    if (body === 'Backup JSON') {
      requestSchema = { type: 'object', description: 'Full sensitive backup JSON; safe exports are rejected for restore.' };
    }
    for (const raw of body === 'Backup JSON' ? [] : fieldList.split(',')) {
      const field = raw.trim().match(/^([A-Za-z][\w]*)(\?)?/);
      if (!field) continue;
      const [, name, optional] = field;
      const type = name === 'quantity' ? { type: 'integer' } : name === 'enabled' ? { type: 'boolean' } : name === 'permissions' ? { type: 'array', items: { type: 'string' } } : name === 'file' ? { type: 'string', format: 'binary' } : { type: 'string' };
      properties[name] = type;
      if (!optional) required.push(name);
    }
    if (/^items\[/.test(body)) {
      const itemFields = body.match(/\[([^\]]+)\]/)?.[1]?.split(',') ?? [];
      properties.items = { type: 'array', items: { type: 'object', properties: Object.fromEntries(itemFields.map(field => [field.replace('?', ''), field.startsWith('quantity') ? { type: 'integer' } : { type: 'string' }])), required: itemFields.filter(field => !field.endsWith('?')).map(field => field.trim()) } };
      required.push('items');
    }
    if (!requestSchema) requestSchema = { type: 'object', description: body, properties, ...(required.length ? { required } : {}) };
  }
  if (path === '/api/auth/2fa/complete' && requestSchema) requestSchema.description = 'El tempToken temporal se envía en este cuerpo, no en Authorization.';
  const requestBody = requestSchema ? { required: true, content: { [body!.startsWith('multipart') ? 'multipart/form-data' : 'application/json']: { schema: requestSchema, ...(path === '/api/auth/2fa/complete' ? { example: { tempToken: 'eyJhbGciOi...', code: '123456' } } : {}) } } } : undefined;
  paths[path] ??= {};
  const access = accessFor(auth);
  const responses: Record<string, any> = { 200: { description: 'Successful response', content: { 'application/json': { schema: successSchema(path, method) } } } };
  if (path === '/api/auth/login') responses['429'] = { description: 'Login attempts are temporarily blocked', headers: { 'Retry-After': { description: 'Seconds until another attempt is allowed', schema: { type: 'integer' } } }, content: { 'application/json': { schema: objectSchema({ error: string, retry_after_seconds: { type: 'integer' }, blocked_until: string }, ['error', 'retry_after_seconds']) } } };
  if (access.security) responses['401'] = error('Missing or invalid authentication credentials');
  if (access.xAccess.admin || access.xAccess.permission) responses['403'] = error('Authenticated caller lacks the required role or permission');
  if (path.includes('{')) responses['404'] = error('Requested resource was not found');
  if (requestSchema) responses['400'] = error('Invalid request body or parameters');
  if (['/api/auth/login', '/api/auth/register', '/api/products', '/api/users', '/api/roles'].includes(path)) responses['409'] = error('Resource conflicts with existing data');
  if (path.includes('/import') || path.includes('/constancias') || path === '/api/backup/restore') responses['413'] = error('Request exceeds the configured size limit');
  if (path === '/health' || path === '/api/health') responses['503'] = { description: 'Database is unavailable' };
  paths[path][method] = { summary, description: `Authentication/access: ${auth}.`, ...(access.security ? { security: access.security } : {}), xAccess: access.xAccess, ...(parameters.length ? { parameters } : {}), ...(requestBody ? { requestBody } : {}), responses };
}

export const openapi = {
  openapi: '3.1.0', info: { title: 'Inventario Rápido API', version: '1.0.0', description: 'REST API. Errors use { error: string }. API keys have administrator privileges.' }, servers: [{ url: '/' }], paths,
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' }, cookieAuth: { type: 'apiKey', in: 'cookie', name: 'token' }, twoFactorToken: { type: 'apiKey', in: 'header', name: 'Authorization', description: 'Temporary token issued at login; send as Bearer token.' } }, schemas: { Error: { type: 'object', required: ['error'], properties: { error: { type: 'string' } } } } },
} as const;

export const openapiYaml = `${JSON.stringify(openapi, null, 2)}\n`;
