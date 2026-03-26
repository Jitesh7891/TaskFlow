const request = require('supertest');
const app = require('../src/app');

describe('Security Middleware Integrity', () => {

    describe('Helmet Security Headers', () => {
        it('should return essential security headers on standard requests', async () => {
            const res = await request(app).get('/health');
            
            // Helmet automatically injects these
            expect(res.headers).toHaveProperty('x-dns-prefetch-control', 'off');
            expect(res.headers).toHaveProperty('x-frame-options', 'SAMEORIGIN');
            expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
            expect(res.headers).toHaveProperty('strict-transport-security');
            
            // Should hide identifying headers
            expect(res.headers).not.toHaveProperty('x-powered-by');
        });
    });

    describe('JSON Payload Size Limits', () => {
        it('should return 413 Payload Too Large when body exceeds 100kb', async () => {
            // Generate a fake string slightly larger than 100kb
            // 1 char = 1 byte (in standard ASCII), so 110,000 chars is ~110kb
            const massiveString = 'a'.repeat(110000); 

            const res = await request(app)
                .post('/auth/login')
                .send({
                    email: 'test@example.com',
                    password: massiveString // Bloated payload
                });

            expect(res.status).toBe(413);
            expect(res.text).toContain('Request entity too large');
        });

        it('should process normal payloads successfully (under 100kb)', async () => {
            const normalString = 'a'.repeat(5000); // 5kb
            
            const res = await request(app)
                .post('/auth/login')
                .send({
                    email: 'test@example.com',
                    password: normalString
                });

            // We expect a 401 (Wrong password) or 400, but NOT a 413 Error.
            // 400 is expected here because Zod validation will fail or fail on auth
            expect(res.status).not.toBe(413);
        });
    });

    describe('CORS Configuration', () => {
        it('should allow local development origin when env var is unset', async () => {
            const res = await request(app)
                .options('/health') // Preflight request
                .set('Origin', 'http://localhost:5173')
                .set('Access-Control-Request-Method', 'GET');
                
            expect(res.headers).toHaveProperty('access-control-allow-origin', 'http://localhost:5173');
            expect(res.headers).toHaveProperty('access-control-allow-credentials', 'true');
        });

        it('should enforce CORS_ORIGIN environment variable if defined', async () => {
            // Temporarily mock the environment variable
            const originalEnvMatch = process.env.CORS_ORIGIN;
            process.env.CORS_ORIGIN = 'https://production.app.com';

            // We need to re-require modules to get the updated env config in CORS
            jest.isolateModules(() => {
                const testApp = require('../src/app');
                return request(testApp)
                    .options('/health')
                    .set('Origin', 'https://production.app.com')
                    .set('Access-Control-Request-Method', 'GET')
                    .then(res => {
                        expect(res.headers).toHaveProperty('access-control-allow-origin', 'https://production.app.com');
                        process.env.CORS_ORIGIN = originalEnvMatch; // Cleanup
                    });
            });
        });
    });
});
