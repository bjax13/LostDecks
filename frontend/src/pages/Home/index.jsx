import Card from '../../components/Card';
import './Home.css';

export default function Home() {
  // Create array of numbers 1-54 and shuffle them
  const numbers = Array.from({ length: 54 }, (_, i) => i + 1);
  const shuffledNumbers = numbers.sort(() => Math.random() - 0.5);

  return (
    <div className="home-container">
      <div className="cards-grid">
        {shuffledNumbers.map((number) => (
          <Card 
            key={number}
            frontContent={null}
            backContent={<h2>{number}/54</h2>}
            className="card-main"
          />
        ))}
      </div>
    </div>
  );
}

