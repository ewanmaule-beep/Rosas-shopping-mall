import { useMemo, useState } from 'react';

type TileType = 'entrance' | 'exit' | 'hall' | 'wall' | ShopType;
type ShopType = 'bakery' | 'toy' | 'pharmacy' | 'clothes' | 'bookshop' | 'supermarket';
type Difficulty = 'easy' | 'medium' | 'hard';

type Position = { row: number; col: number };
type ListItem = {
  id: string;
  name: string;
  validShops: ShopType[];
  collected: boolean;
};

type BaseItem = Omit<ListItem, 'collected'>;
type GameState = 'start' | 'playing' | 'finished';

const MALL_GRID: TileType[][] = [
  ['entrance', 'hall', 'bakery', 'wall', 'toy', 'hall'],
  ['wall', 'hall', 'hall', 'wall', 'hall', 'hall'],
  ['pharmacy', 'hall', 'clothes', 'hall', 'bookshop', 'wall'],
  ['wall', 'hall', 'hall', 'wall', 'hall', 'hall'],
  ['supermarket', 'hall', 'hall', 'hall', 'hall', 'exit']
];

const SHOP_LABELS: Record<ShopType, string> = {
  bakery: 'Bakery',
  toy: 'Toy Shop',
  pharmacy: 'Pharmacy',
  clothes: 'Clothes',
  bookshop: 'Bookshop',
  supermarket: 'Supermarket'
};

const CATALOG: BaseItem[] = [
  { id: 'bread', name: 'Loaf of Bread', validShops: ['bakery', 'supermarket'] },
  { id: 'cake', name: 'Birthday Cake', validShops: ['bakery'] },
  { id: 'toycar', name: 'Toy Car', validShops: ['toy'] },
  { id: 'doll', name: 'Doll', validShops: ['toy'] },
  { id: 'painkiller', name: 'Pain Relief', validShops: ['pharmacy'] },
  { id: 'vitamins', name: 'Vitamins', validShops: ['pharmacy', 'supermarket'] },
  { id: 'shirt', name: 'T-Shirt', validShops: ['clothes'] },
  { id: 'jeans', name: 'Jeans', validShops: ['clothes'] },
  { id: 'novel', name: 'Novel', validShops: ['bookshop'] },
  { id: 'notebook', name: 'Notebook', validShops: ['bookshop', 'supermarket'] },
  { id: 'milk', name: 'Milk', validShops: ['supermarket'] },
  { id: 'apples', name: 'Apples', validShops: ['supermarket'] }
];

const ENTRANCE: Position = { row: 0, col: 0 };
const EXIT: Position = { row: 4, col: 5 };
const DAILY_EPOCH_UTC_MS = Date.UTC(2026, 0, 1);

const DIFFICULTY_SETTINGS: Record<Difficulty, { itemCount: number; label: string }> = {
  easy: { itemCount: 3, label: 'Easy' },
  medium: { itemCount: 4, label: 'Medium' },
  hard: { itemCount: 5, label: 'Hard' }
};

const getDailyPuzzleNumber = (date = new Date()): number => {
  const utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const diffDays = Math.floor((utcDate - DAILY_EPOCH_UTC_MS) / 86400000);
  return Math.max(1, diffDays + 1);
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
};

const seededRandom = (seed: number): (() => number) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

const createShoppingList = (seedKey: string, difficulty: Difficulty): BaseItem[] => {
  const itemCount = DIFFICULTY_SETTINGS[difficulty].itemCount;
  const rng = seededRandom(hashString(seedKey));

  const eligibleItems =
    difficulty === 'hard'
      ? CATALOG.filter((item) => item.validShops.length === 1)
      : CATALOG;

  const pool = [...eligibleItems];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(rng() * (i + 1));
    [pool[i], pool[swapIndex]] = [pool[swapIndex], pool[i]];
  }

  return pool.slice(0, itemCount);
};

const toActiveList = (baseItems: BaseItem[]): ListItem[] =>
  baseItems.map((item) => ({ ...item, collected: false }));

const isShop = (tile: TileType): tile is ShopType =>
  ['bakery', 'toy', 'pharmacy', 'clothes', 'bookshop', 'supermarket'].includes(tile);

const App = (): JSX.Element => {
  const puzzleNumber = getDailyPuzzleNumber();

  const [gameState, setGameState] = useState<GameState>('start');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [player, setPlayer] = useState<Position>(ENTRANCE);
  const [moves, setMoves] = useState(0);
  const [baseItems, setBaseItems] = useState<BaseItem[]>([]);
  const [shoppingList, setShoppingList] = useState<ListItem[]>([]);

  const pendingCount = useMemo(
    () => shoppingList.filter((item) => !item.collected).length,
    [shoppingList]
  );

  const canFinish = pendingCount === 0;

  const startGame = (): void => {
    const seedKey = `rosas-shopping-mall:${puzzleNumber}:${difficulty}`;
    const nextBaseItems = createShoppingList(seedKey, difficulty);

    setGameState('playing');
    setPlayer(ENTRANCE);
    setMoves(0);
    setBaseItems(nextBaseItems);
    setShoppingList(toActiveList(nextBaseItems));
  };

  const resetRun = (): void => {
    if (baseItems.length === 0) return;
    setGameState('playing');
    setPlayer(ENTRANCE);
    setMoves(0);
    setShoppingList(toActiveList(baseItems));
  };

  const handleMove = (dRow: number, dCol: number): void => {
    if (gameState !== 'playing') return;

    const nextRow = player.row + dRow;
    const nextCol = player.col + dCol;

    if (
      nextRow < 0 ||
      nextRow >= MALL_GRID.length ||
      nextCol < 0 ||
      nextCol >= MALL_GRID[0].length ||
      MALL_GRID[nextRow][nextCol] === 'wall'
    ) {
      return;
    }

    const nextTile = MALL_GRID[nextRow][nextCol];
    let updatedList = shoppingList;

    if (isShop(nextTile)) {
      updatedList = shoppingList.map((item) =>
        !item.collected && item.validShops.includes(nextTile) ? { ...item, collected: true } : item
      );
      setShoppingList(updatedList);
    }

    setPlayer({ row: nextRow, col: nextCol });
    setMoves((prev) => prev + 1);

    if (nextTile === 'exit' && updatedList.every((item) => item.collected)) {
      setGameState('finished');
    }
  };

  const scoreIcon = moves <= 14 ? '🟢' : moves <= 20 ? '🟡' : '🔴';
  const shareText = [
    `Rosa's Shopping Mall #${puzzleNumber}`,
    `Difficulty: ${DIFFICULTY_SETTINGS[difficulty].label}`,
    `Moves: ${moves} ${scoreIcon}`,
    `Items: ${shoppingList.length}/${shoppingList.length} collected`
  ].join('\n');

  const shareResult = async (): Promise<void> => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Rosa's Shopping Mall #${puzzleNumber}`,
          text: shareText
        });
      } catch {
        // ignore cancelled share
      }
      return;
    }

    await navigator.clipboard.writeText(shareText);
    alert('Result copied to clipboard!');
  };

  return (
    <main className="app">
      <header>
        <h1>Rosa&apos;s Shopping Mall</h1>
      </header>

      <section className="panel help">
        <h2>How to play</h2>
        <p>Collect every shopping list item at the right shop, then reach the exit in as few moves as possible.</p>
      </section>

      {gameState === 'start' && (
        <section className="panel start">
          <h2>Daily Puzzle #{puzzleNumber}</h2>
          <p className="meta">Pick a difficulty and start.</p>
          <div className="difficultyButtons">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
              <button
                key={level}
                className={difficulty === level ? 'selected' : ''}
                onClick={() => setDifficulty(level)}
              >
                {DIFFICULTY_SETTINGS[level].label}
              </button>
            ))}
          </div>
          <button onClick={startGame}>Start Daily Puzzle</button>
        </section>
      )}

      {gameState !== 'start' && (
        <>
          <section className="panel">
            <p className="meta">Puzzle: #{puzzleNumber}</p>
            <p className="meta">Difficulty: {DIFFICULTY_SETTINGS[difficulty].label}</p>
            <p className="meta">Moves: {moves}</p>
            <p className="meta">Items left: {pendingCount}</p>
            <div className="list">
              {shoppingList.map((item) => (
                <p key={item.id} className={item.collected ? 'done' : ''}>
                  {item.collected ? '✅' : '⬜'} {item.name}
                </p>
              ))}
            </div>
          </section>

          <section className="grid" aria-label="Mall map">
            {MALL_GRID.map((row, rowIndex) =>
              row.map((tile, colIndex) => {
                const isPlayer = player.row === rowIndex && player.col === colIndex;
                const classes = ['tile', tile, isPlayer ? 'player' : ''].join(' ').trim();

                return (
                  <div className={classes} key={`${rowIndex}-${colIndex}`}>
                    {isPlayer
                      ? '🛒'
                      : tile === 'entrance'
                        ? 'IN'
                        : tile === 'exit'
                          ? 'OUT'
                          : isShop(tile)
                            ? SHOP_LABELS[tile]
                            : ''}
                  </div>
                );
              })
            )}
          </section>

          <section className="controls">
            <button onClick={() => handleMove(-1, 0)}>↑</button>
            <div>
              <button onClick={() => handleMove(0, -1)}>←</button>
              <button onClick={() => handleMove(0, 1)}>→</button>
            </div>
            <button onClick={() => handleMove(1, 0)}>↓</button>
          </section>

          <section className="actions">
            <button onClick={resetRun}>Reset Run</button>
          </section>

          {player.row === EXIT.row && player.col === EXIT.col && !canFinish && (
            <p className="hint">Collect all items before exiting.</p>
          )}
        </>
      )}

      {gameState === 'finished' && (
        <section className="panel result">
          <h2>Great shopping run!</h2>
          <p>You finished in {moves} moves.</p>
          <pre>{shareText}</pre>
          <div className="actions">
            <button onClick={shareResult}>Share Result</button>
            <button onClick={startGame}>Play Again</button>
            <button onClick={resetRun}>Retry Same Puzzle</button>
          </div>
        </section>
      )}
    </main>
  );
};

export default App;
