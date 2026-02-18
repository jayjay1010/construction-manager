import jwt from "jsonwebtoken";

export function requireAuth(req,res,next){

    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if(!token){
        return res.status(401).json({error: "Missing"});
    }
    
    try{
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        next();

    } catch{
         return res.status(401).json({error: "invalid token"});
    }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(401).json({ error: "No user role" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    next();
  };
}

