import Card from '../../components/Card';
import './Home.css';

export default function Home() {
  // Create array of numbers 1-54 and shuffle them
  const numbers = Array.from({ length: 54 }, (_, i) => i + 1);
  const shuffledNumbers = numbers.sort(() => Math.random() - 0.5);
  
  // Define available themes for cycling
  const themes = ['default', 'elsecaller', 'lopen', 'chasm'];

  return (
    <div className="home-container">
      <div className="cards-grid">
        {shuffledNumbers.map((number, index) => (
          <Card 
            key={number}
            frontContent={null}
            backContent={<h2>{number}/54</h2>}
            className="card-main"
            theme={themes[index % themes.length]}
            isNonsense={index % 4 === 0} // Every 4th card is nonsense
          />
        ))}
      </div>
    </div>
  );
}

