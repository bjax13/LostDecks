/** Stormlight Lost Tales — Story Deck (LT24) typed interfaces with distinct SKU records */

// Base enums and types
export type StoryCode = 'ELS' | 'LOP' | 'CHM'; // Elsecaller, Lopen, Chasmfriends
export type Finish = 'dun' | 'foil';
export type RarityTier = 'base' | 'rare';
export type SetId = 'LT24';
export type Category = 'story' | 'herald' | 'nonsense';

// Herald names as a reusable type
export type HeraldName = 'Jezrien' | 'Nale' | 'Chanarach' | 'Vedel' | 'Paliah' | 'Shalash' | 'Kalak' | 'Talenel' | 'Ishar';

// Nonsense variant names enum
export type VariantName = 'Dance' | 'Mouse' | 'Pirates' | 'Scadrial' | 'Sew' | 'Stolen' | 'Traded' | 'Whale';

// Story-specific nonsense card number ranges
export type NonsenseCardNumbers = {
  ELS: 2 | 6 | 7 | 10 | 14 | 20 | 24 | 28 | 30 | 34 | 38 | 42 | 43 | 50 | 54;
  LOP: 1 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18;
  CHM: 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27;
};

// Conditional type to get valid nonsense numbers for a specific story
export type NonsenseNumbersForStory<StoryType extends StoryCode> = NonsenseCardNumbers[StoryType];

// Utility types for working with nonsense cards
export type NonsenseCardForStory<StoryType extends StoryCode> = NonsenseCard<StoryType>;
export type AllNonsenseNumbers = NonsenseCardNumbers[StoryCode];

// Utility types for common ranges
export type Digit1To9 = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Digit1To3 = 1 | 2 | 3;

// Template literal types for ID generation
export type StoryCardId = `${SetId}-${StoryCode}-${string}`;
export type HeraldCardId = `${SetId}-HLD-${string}`;
export type NonsenseCardId = `${SetId}-NS-${StoryCode}-${string}`;
export type CardId = StoryCardId | HeraldCardId | NonsenseCardId;

// SKU ID types
export type StorySkuId = `${StoryCardId}#${Uppercase<Finish>}`;
export type HeraldSkuId = `${HeraldCardId}#${Uppercase<Finish>}`;
export type NonsenseSkuId = `${NonsenseCardId}#${Uppercase<Finish>}`;
export type SkuId = StorySkuId | HeraldSkuId | NonsenseSkuId;

export interface BinderMosaic {
  page: number;      // 1..6 (9-card pages)
  position: Digit1To9;  // 1..9 within page (L->R, T->B)
  row: Digit1To3;       // 1..3
  col: Digit1To3;       // 1..3
}

export interface Story {
  code: StoryCode;
  title: string;
}

export interface StoryCard {
  id: StoryCardId;          // e.g., LT24-ELS-01
  setId: SetId;
  category: 'story';
  story: StoryCode;
  storyTitle: string;
  number: number;           // 1..54
  rarityTier: RarityTier;
  mosaic: BinderMosaic;
}

export interface HeraldCard {
  id: HeraldCardId;        // e.g., LT24-HLD-01
  setId: SetId;
  category: 'herald';
  number: Digit1To9;        // 1..9
  rarityTier: RarityTier;
  heraldName: HeraldName;
}

export interface NonsenseCard<StoryType extends StoryCode = StoryCode> {
  id: NonsenseCardId;      // e.g., LT24-NS-ELS-24-DANCE (label normalized uppercase, non-alnum stripped)
  setId: SetId;
  category: 'nonsense';
  story: StoryType;
  baseNumber: NonsenseNumbersForStory<StoryType>;  // points to the story card number it alters
  variantName: VariantName | null;
}

export interface SKU {
  skuId: SkuId;             // e.g., LT24-ELS-01#STD or LT24-NS-ELS-24-DANCE#FOIL
  cardId: CardId;           // references any card id (StoryCard | HeraldCard | NonsenseCard)
  finish: Finish;
}

export interface NonsenseVariantInfo {
  id: NonsenseCardId;       // e.g., LT24-NS-ELS-24 (variant group root)
  story: StoryCode;
  baseNumber: number;
  variantCount: number;
}

export interface NonsenseSummary {
  totalsByStory: Record<StoryCode, number>;
  total: number;
  knownVariants: NonsenseVariantInfo[];
  knownCards: NonsenseCard[];
}

export interface LT24DataSet {
  meta: {
    setId: SetId;
    setName: string;
    releaseEvent: string;
    totalUniqueCards: number;     // 215
    totalSkus: number;            // 430
    notes: string[];
    packConfigurationExample: {
      cardsPerPack: number;       // 15
      composition: string;
    };
  };
  stories: Story[];
  cards: StoryCard[];
  heralds: HeraldCard[];
  nonsense: NonsenseSummary;
  skus: SKU[];
  index: {
    byId: Record<CardId, StoryCard | HeraldCard | NonsenseCard>;
    bySkuId: Record<SkuId, SKU>;
    byStoryNumber: Record<StoryCode, Record<number, CardId>>; // maps story number -> id
  };
}
