const { auth } = require('express-oauth2-jwt-bearer');
const jwt = require('express-jwt');
const jwks = require('jwks-rsa');

// Auth0 configuration
const authConfig = {
    domain: 'YOUR_DOMAIN_NAME', //something like "dev-xxxxxxxxxxxxxxxx.us.auth0.com"
    audience: 'YOUR_IDENTIFIER_URL' //something like "http://localhost/api"
};

// JWT validation middleware
const checkJwt = auth({
    audience: authConfig.audience,
    issuerBaseURL: `https://${authConfig.domain}/`,
    algorithms: ['RS256']
});

// Permission middleware
const checkPermissions = (requiredPermissions) => {
    return (req, res, next) => {
        const permissions = req.auth?.permissions || [];
        const hasPermissions = requiredPermissions.every(permission => 
            permissions.includes(permission)
        );

        if (!hasPermissions) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        next();
    };
};

module.exports = {
    checkJwt,
    checkPermissions
};