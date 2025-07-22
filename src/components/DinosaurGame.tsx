import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface DinosaurGameProps {
  isOpen: boolean;
  onClose: () => void;
}

const DinosaurGame: React.FC<DinosaurGameProps> = ({ isOpen, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'gameOver'>('waiting');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('dino-high-score');
    return saved ? parseInt(saved) : 0;
  });

  // Game objects
  const gameRef = useRef({
    dino: {
      x: 80,
      y: 200,
      width: 20,
      height: 20,
      velocityY: 0,
      isJumping: false,
      isDucking: false
    },
    obstacles: [] as Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      type: 'cactus' | 'bird';
    }>,
    clouds: [] as Array<{
      x: number;
      y: number;
      width: number;
    }>,
    ground: {
      x: 0,
      width: 2400
    },
    speed: 6,
    lastObstacleSpawn: 0,
    lastCloudSpawn: 0
  });

  const GRAVITY = 0.8;
  const JUMP_FORCE = -15;
  const GROUND_Y = 220;
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 300;

  const resetGame = useCallback(() => {
    const game = gameRef.current;
    game.dino.y = GROUND_Y - game.dino.height;
    game.dino.velocityY = 0;
    game.dino.isJumping = false;
    game.dino.isDucking = false;
    game.obstacles = [];
    game.clouds = [];
    game.speed = 6;
    game.lastObstacleSpawn = 0;
    game.lastCloudSpawn = 0;
    setScore(0);
    setGameState('waiting');
  }, []);

  const jump = useCallback(() => {
    const game = gameRef.current;
    if (!game.dino.isJumping && gameState === 'playing') {
      game.dino.velocityY = JUMP_FORCE;
      game.dino.isJumping = true;
    }
  }, [gameState]);

  const duck = useCallback((isDucking: boolean) => {
    const game = gameRef.current;
    if (gameState === 'playing') {
      game.dino.isDucking = isDucking;
      game.dino.height = isDucking ? 15 : 20;
    }
  }, [gameState]);

  const startGame = useCallback(() => {
    resetGame();
    setGameState('playing');
  }, [resetGame]);

  // Collision detection
  const checkCollision = useCallback(() => {
    const game = gameRef.current;
    const dino = game.dino;
    
    for (const obstacle of game.obstacles) {
      if (
        dino.x < obstacle.x + obstacle.width &&
        dino.x + dino.width > obstacle.x &&
        dino.y < obstacle.y + obstacle.height &&
        dino.y + dino.height > obstacle.y
      ) {
        return true;
      }
    }
    return false;
  }, []);

  // Game loop
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || gameState !== 'playing') return;

    const game = gameRef.current;
    
    // Clear canvas
    ctx.fillStyle = '#f7f7f7';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Update dino physics
    if (game.dino.isJumping) {
      game.dino.velocityY += GRAVITY;
      game.dino.y += game.dino.velocityY;
      
      if (game.dino.y >= GROUND_Y - game.dino.height) {
        game.dino.y = GROUND_Y - game.dino.height;
        game.dino.isJumping = false;
        game.dino.velocityY = 0;
      }
    }

    // Update ground
    game.ground.x -= game.speed;
    if (game.ground.x <= -1200) {
      game.ground.x = 0;
    }

    // Draw ground
    ctx.fillStyle = '#535353';
    ctx.fillRect(0, GROUND_Y + 20, CANVAS_WIDTH, 2);

    // Spawn obstacles
    const now = Date.now();
    if (now - game.lastObstacleSpawn > 1500 + Math.random() * 2000) {
      const type = Math.random() > 0.7 ? 'bird' : 'cactus';
      game.obstacles.push({
        x: CANVAS_WIDTH,
        y: type === 'bird' ? GROUND_Y - 40 : GROUND_Y - 20,
        width: type === 'bird' ? 24 : 16,
        height: type === 'bird' ? 16 : 20,
        type
      });
      game.lastObstacleSpawn = now;
    }

    // Update and draw obstacles
    game.obstacles = game.obstacles.filter(obstacle => {
      obstacle.x -= game.speed;
      
      // Draw obstacle
      ctx.fillStyle = obstacle.type === 'bird' ? '#aa6c39' : '#535353';
      if (obstacle.type === 'cactus') {
        // Draw simple cactus
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        ctx.fillRect(obstacle.x + 4, obstacle.y - 6, 8, 6);
      } else {
        // Draw simple bird
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        ctx.fillRect(obstacle.x + 2, obstacle.y - 2, 6, 2);
        ctx.fillRect(obstacle.x + 2, obstacle.y + obstacle.height, 6, 2);
      }
      
      return obstacle.x > -obstacle.width;
    });

    // Spawn clouds
    if (now - game.lastCloudSpawn > 3000 + Math.random() * 2000) {
      game.clouds.push({
        x: CANVAS_WIDTH,
        y: 50 + Math.random() * 80,
        width: 30 + Math.random() * 20
      });
      game.lastCloudSpawn = now;
    }

    // Update and draw clouds
    game.clouds = game.clouds.filter(cloud => {
      cloud.x -= game.speed * 0.3;
      
      // Draw cloud
      ctx.fillStyle = '#c0c0c0';
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, 8, 0, Math.PI * 2);
      ctx.arc(cloud.x + 12, cloud.y, 10, 0, Math.PI * 2);
      ctx.arc(cloud.x + 24, cloud.y, 8, 0, Math.PI * 2);
      ctx.fill();
      
      return cloud.x > -cloud.width;
    });

    // Draw dino
    ctx.fillStyle = '#535353';
    if (game.dino.isDucking) {
      ctx.fillRect(game.dino.x, game.dino.y + 5, game.dino.width, game.dino.height);
      ctx.fillRect(game.dino.x + game.dino.width, game.dino.y + 8, 8, 6);
    } else {
      ctx.fillRect(game.dino.x, game.dino.y, game.dino.width, game.dino.height);
      ctx.fillRect(game.dino.x + 4, game.dino.y - 4, 8, 4);
      ctx.fillRect(game.dino.x + game.dino.width, game.dino.y + 12, 6, 8);
    }

    // Draw eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(game.dino.x + 14, game.dino.y + 2, 2, 2);

    // Check collision
    if (checkCollision()) {
      setGameState('gameOver');
      const newScore = score;
      if (newScore > highScore) {
        setHighScore(newScore);
        localStorage.setItem('dino-high-score', newScore.toString());
      }
      return;
    }

    // Update score and speed
    const newScore = Math.floor(Date.now() / 100) - Math.floor(Date.now() / 100) + Math.floor(score + 1);
    setScore(prev => prev + 1);
    
    if (score % 100 === 0) {
      game.speed += 0.5;
    }

    // Continue game loop
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, score, highScore, checkCollision]);

  // Start game loop
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoop();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, gameLoop]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      e.preventDefault();
      switch (e.key) {
        case ' ':
        case 'ArrowUp':
          if (gameState === 'waiting' || gameState === 'gameOver') {
            startGame();
          } else {
            jump();
          }
          break;
        case 'ArrowDown':
          duck(true);
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'ArrowDown') {
        duck(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, gameState, jump, duck, startGame, onClose]);

  // Reset game when dialog opens
  useEffect(() => {
    if (isOpen) {
      resetGame();
    }
  }, [isOpen, resetGame]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[90vw] h-[60vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-6">
            <span className="text-lg font-mono">Score: {score.toString().padStart(5, '0')}</span>
            <span className="text-lg font-mono">High: {highScore.toString().padStart(5, '0')}</span>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ×
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border border-gray-300 bg-gray-100"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
        
        <div className="text-center mt-4">
          {gameState === 'waiting' && (
            <div>
              <p className="text-gray-600 mb-2">Press SPACE or ↑ to start</p>
              <p className="text-sm text-gray-500">Use ↑ to jump, ↓ to duck, ESC to close</p>
            </div>
          )}
          {gameState === 'gameOver' && (
            <div>
              <p className="text-red-600 mb-2">Game Over!</p>
              <p className="text-gray-600 mb-2">Press SPACE or ↑ to restart</p>
              <p className="text-sm text-gray-500">Use ↑ to jump, ↓ to duck, ESC to close</p>
            </div>
          )}
          {gameState === 'playing' && (
            <p className="text-sm text-gray-500">Use ↑ to jump, ↓ to duck, ESC to close</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DinosaurGame;