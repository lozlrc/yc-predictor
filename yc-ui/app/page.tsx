import ScoreForm from "../components/ScoreForm";

export default function Page() {
  return (
    <main>
      <header className="masthead">
        <p className="kicker">Pitch Signal</p>
        <h1 className="masthead__title">YC Predictor</h1>
        <p className="masthead__lede">
          Reads a YouTube pitch, its transcript and opening frames, and estimates how YC-like it looks.
          Returns a probability, nothing more.
        </p>
      </header>

      <ScoreForm />
    </main>
  );
}
