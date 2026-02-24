import "./UI.css";

// Static configuration (outside component = no re-creation)
const WORDS = ["REACT", "SWARM", "PHYSICS", "CODE", "CREATE", "FLOW"];

// PROPS:
// currentWord: string — currently active word (from parent state)
// onChangeWord: function — callback to update parent state
//
// PATTERN: Lifting state up — parent owns data, child requests changes
export function UI({ currentWord, onChangeWord }) {
  return (
    // JSX uses className (not class) because class is JS reserved word
    <div className="ui-container">
      <div className="ui-panel">
        <h3>Current Word</h3>

        {/* Display current state */}
        <div className="word-display">{currentWord}</div>

        <h4>Word Bank</h4>
        <div className="word-grid">
          {/* Array.map: O(n) where n = WORDS.length (6 items) */}
          {WORDS.map((w) => (
            <button
              key={w} // React requires unique key for list items (O(1) diffing)
              className={`word-btn ${w === currentWord ? "active" : ""}`}
              onClick={() => onChangeWord(w)} // Callback to parent: O(1)
            >
              {w}
            </button>
          ))}
        </div>

        <div className="hint">
          Move mouse to attract letters
          <br />
          Leave canvas to form word
        </div>
      </div>
    </div>
  );
}
