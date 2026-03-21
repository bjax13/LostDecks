import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import Card from './Card.jsx';

describe('Card (integration)', () => {
  it('locks a hover flip so the card stays flipped', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Card
        frontContent={<span>Front</span>}
        backContent={<span>Back face</span>}
        isNonsense={false}
      />,
    );
    const card = container.firstElementChild;
    expect(card).toBeTruthy();

    await user.hover(card);
    expect(card).toHaveClass('flipped');

    await user.click(card);
    expect(card).toHaveClass('flipped', 'locked');

    await user.unhover(card);
    expect(card).toHaveClass('flipped', 'locked');
  });
});
