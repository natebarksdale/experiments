import { motion } from 'framer-motion';
import './AuthButton.css';

export default function AuthButton({ isAuthenticated, onSignIn, onSignOut, userEmail }) {
  return (
    <div className="auth-button-wrapper">
      {!isAuthenticated ? (
        <motion.button
          className="auth-button auth-button--signin"
          onClick={onSignIn}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="auth-icon">🔐</span>
          <span className="mono">Sign In</span>
        </motion.button>
      ) : (
        <div className="auth-status">
          {userEmail && (
            <span className="auth-email mono">{userEmail}</span>
          )}
          <motion.button
            className="auth-button auth-button--signout"
            onClick={onSignOut}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="mono">Sign Out</span>
          </motion.button>
        </div>
      )}
    </div>
  );
}
