import { Link } from "react-router-dom";

/**
 * Consent line shown on every sign-up surface (register page, auth modal register mode,
 * and under social login when creating an account).
 */
export default function SignupConsent({ onNavigate } = {}) {
  const linkProps = onNavigate
    ? {
        onClick: () => {
          onNavigate();
        },
      }
    : {};

  return (
    <p className="signup-consent">
      By creating an account you agree to the{" "}
      <Link to="/terms" className="signup-consent__link" {...linkProps}>
        Terms
      </Link>{" "}
      and{" "}
      <Link to="/privacy" className="signup-consent__link" {...linkProps}>
        Privacy Policy
      </Link>
      . If you match with another collector, they&apos;ll see your contact (your email by default;
      change it in Account).
    </p>
  );
}
