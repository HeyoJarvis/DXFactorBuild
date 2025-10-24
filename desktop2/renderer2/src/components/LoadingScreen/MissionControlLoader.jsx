import './MissionControlLoader.css';

/**
 * MissionControlLoader - Smooth transition animation when opening Mission Control
 * Replicates the morph animation from LoginFlow:
 * 1. Expanding orb from center
 * 2. "Mission Control" text appears
 * 3. Fade to actual dashboard
 */
export default function MissionControlLoader({ isVisible = true }) {
  if (!isVisible) return null;

  return (
    <div className="mission-control-loader">
      <div className="loader-orb"></div>
      <div className="loader-text">Mission Control</div>
    </div>
  );
}
