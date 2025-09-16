const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.session.user || !allowedRoles.includes(req.session.user.rol)) {
            return res.status(403).send('<h1>Acceso Prohibido</h1><p>No tienes permiso para ver esta página.</p>');
        }
        next();
    };
};

module.exports = {
    checkRole
};