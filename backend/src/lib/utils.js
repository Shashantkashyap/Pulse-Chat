import jwt from "jsonwebtoken";

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  // Update cookie settings for production
  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'none', // Important for cross-site requests
    secure: true, // Required for sameSite: 'none'
    path: '/',
    domain:  '.onrender.com'
  });

  return token;
};
