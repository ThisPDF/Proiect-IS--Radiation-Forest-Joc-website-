"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Sky, Text, useTexture, Environment, Sphere, Box, Stars } from "@react-three/drei"
import { Vector3 } from "three"
import { Physics, usePlane, useBox } from "@react-three/cannon"
import { Bloom, EffectComposer, DepthOfField, Noise } from "@react-three/postprocessing"
import * as THREE from "three"

// Game constants
const ISLAND_RADIUS = 30
const MOVEMENT_SPEED = 0.15
const ROTATION_SPEED = 0.03
const BUILD_GRID_SIZE = 2
const ENEMY_SPAWN_DISTANCE = 35
const GRAVITY = [0, -9.81, 0]

// Game state
const initialCharacters = [
  { id: 1, name: "King", color: "#FFD700", position: [0, 1, 0], role: "Leader", health: 100, speed: 1.0 },
  { id: 2, name: "Builder", color: "#8B4513", position: [5, 1, 2], role: "Construction", health: 80, speed: 1.2 },
  { id: 3, name: "Archer", color: "#228B22", position: [-5, 1, 2], role: "Defense", health: 70, speed: 1.3 },
  { id: 4, name: "Knight", color: "#4682B4", position: [0, 1, 5], role: "Combat", health: 120, speed: 0.9 },
]

const buildingTypes = [
  { id: "wall", name: "Wall", size: [4, 2, 0.5], color: "#696969", cost: 10, health: 100 },
  { id: "tower", name: "Tower", size: [2, 5, 2], color: "#A9A9A9", cost: 25, health: 150 },
  { id: "barracks", name: "Barracks", size: [4, 2, 4], color: "#8B4513", cost: 40, health: 200 },
]

export default function GameConcept() {
  const [characters, setCharacters] = useState(initialCharacters)
  const [activeCharacterId, setActiveCharacterId] = useState(1)
  const [gameMode, setGameMode] = useState("third-person") // "first-person" or "third-person"
  const [buildMode, setBuildMode] = useState(false)
  const [selectedBuildingType, setSelectedBuildingType] = useState(buildingTypes[0])
  const [buildings, setBuildings] = useState([
    { id: 1, type: "castle", position: [0, 1, -5], size: [8, 6, 8], color: "#808080", health: 500 },
  ])
  const [buildPreview, setBuildPreview] = useState(null)
  const [enemies, setEnemies] = useState([])
  const [waveNumber, setWaveNumber] = useState(0)
  const [waveIncoming, setWaveIncoming] = useState(false)
  const [resources, setResources] = useState(100)
  const [gameTime, setGameTime] = useState(0)
  const [tasks, setTasks] = useState([])
  const [showTaskMenu, setShowTaskMenu] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)

  // Use refs for camera values to avoid re-renders
  const cameraPositionRef = useRef([0, 10, 20])
  const cameraTargetRef = useRef([0, 0, 0])

  const activeCharacter = characters.find((c) => c.id === activeCharacterId) || characters[0]

  // Store character positions in a ref to avoid unnecessary re-renders
  const characterPositionsRef = useRef({})

  // Initialize character positions ref
  useEffect(() => {
    characters.forEach((char) => {
      characterPositionsRef.current[char.id] = {
        position: [...char.position],
        rotation: 0,
      }
    })
  }, [])

  // Start game
  const startGame = () => {
    setGameStarted(true)
    spawnWave()
  }

  // Game timer
  useEffect(() => {
    if (!gameStarted || gameOver) return

    const timer = setInterval(() => {
      setGameTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [gameStarted, gameOver])

  // Wave system
  const spawnWave = () => {
    setWaveIncoming(true)
    setTimeout(() => {
      const newWaveNumber = waveNumber + 1
      setWaveNumber(newWaveNumber)

      // Generate enemies based on wave number
      const newEnemies = []
      const enemyCount = Math.min(3 + newWaveNumber, 15)

      for (let i = 0; i < enemyCount; i++) {
        const angle = (Math.PI * 2 * i) / enemyCount
        const x = Math.sin(angle) * ENEMY_SPAWN_DISTANCE
        const z = Math.cos(angle) * ENEMY_SPAWN_DISTANCE

        newEnemies.push({
          id: Date.now() + i,
          position: [x, 1, z],
          color: "#FF0000",
          health: 50 + newWaveNumber * 10,
          speed: 0.05 + newWaveNumber * 0.005,
          damage: 10 + newWaveNumber * 2,
          target: [0, 1, -5], // Target the castle
        })
      }

      setEnemies((prev) => [...prev, ...newEnemies])
      setWaveIncoming(false)

      // Schedule next wave
      setTimeout(() => {
        if (!gameOver) spawnWave()
      }, 60000) // 1 minute between waves
    }, 10000) // 10 second warning
  }

  // Character movement - modified to use refs and batch updates
  const moveCharacter = (id, newPosition, rotation) => {
    // Update the ref immediately
    characterPositionsRef.current[id] = {
      position: newPosition,
      rotation,
    }

    // Batch state updates with requestAnimationFrame to avoid excessive re-renders
    if (!characterPositionsRef.current.updateScheduled) {
      characterPositionsRef.current.updateScheduled = true

      requestAnimationFrame(() => {
        setCharacters((prev) =>
          prev.map((char) => {
            if (char.id === id) {
              const updatedPos = characterPositionsRef.current[id].position
              return {
                ...char,
                position: updatedPos,
              }
            }
            return char
          }),
        )
        characterPositionsRef.current.updateScheduled = false
      })
    }
  }

  // Building placement
  const placeBuilding = (position) => {
    if (resources < selectedBuildingType.cost) return

    // Snap to grid
    const x = Math.round(position[0] / BUILD_GRID_SIZE) * BUILD_GRID_SIZE
    const z = Math.round(position[2] / BUILD_GRID_SIZE) * BUILD_GRID_SIZE

    setBuildings((prev) => [
      ...prev,
      {
        id: Date.now(),
        type: selectedBuildingType.id,
        position: [x, 1, z],
        size: selectedBuildingType.size,
        color: selectedBuildingType.color,
        health: selectedBuildingType.health,
      },
    ])

    setResources((prev) => prev - selectedBuildingType.cost)
    setBuildPreview(null)
  }

  // Update build preview position
  const updateBuildPreview = (position) => {
    if (!buildMode) return

    // Snap to grid
    const x = Math.round(position[0] / BUILD_GRID_SIZE) * BUILD_GRID_SIZE
    const z = Math.round(position[2] / BUILD_GRID_SIZE) * BUILD_GRID_SIZE

    setBuildPreview({ ...selectedBuildingType, position: [x, 1, z] })
  }

  // Assign task
  const assignTask = (characterId, task) => {
    setTasks((prev) => [...prev, { id: Date.now(), characterId, task, completed: false }])
    setShowTaskMenu(false)
  }

  // Check game over condition
  useEffect(() => {
    const castle = buildings.find((b) => b.type === "castle")
    if (gameStarted && (!castle || castle.health <= 0)) {
      setGameOver(true)
    }
  }, [buildings, gameStarted])

  // Update camera based on active character - using refs to avoid re-renders
  useEffect(() => {
    if (activeCharacter) {
      const pos = activeCharacter.position
      cameraTargetRef.current = [pos[0], pos[1], pos[2]]

      if (gameMode === "third-person") {
        cameraPositionRef.current = [pos[0], pos[1] + 10, pos[2] + 10]
      }
    }
  }, [activeCharacter, gameMode])

  return (
    <div className="relative w-full h-screen">
      {!gameStarted ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="bg-gray-800 p-8 rounded-lg max-w-md text-center">
            <h1 className="text-3xl font-bold text-yellow-400 mb-4">Island Kingdom Defense</h1>
            <p className="text-white mb-6">
              Build your defenses, command your characters, and protect your castle from waves of enemies!
            </p>
            <button
              className="px-6 py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition"
              onClick={startGame}
            >
              Start Game
            </button>
          </div>
        </div>
      ) : gameOver ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="bg-gray-800 p-8 rounded-lg max-w-md text-center">
            <h1 className="text-3xl font-bold text-red-500 mb-4">Game Over</h1>
            <p className="text-white mb-2">Your castle has fallen!</p>
            <p className="text-white mb-6">You survived {waveNumber} waves</p>
            <button
              className="px-6 py-3 bg-yellow-500 text-black font-bold rounded-lg hover:bg-yellow-400 transition"
              onClick={() => window.location.reload()}
            >
              Play Again
            </button>
          </div>
        </div>
      ) : null}

      <Canvas shadows>
        <EffectComposer>
          <Bloom intensity={0.5} luminanceThreshold={0.9} />
          <DepthOfField focusDistance={0} focalLength={0.02} bokehScale={2} height={480} />
          <Noise opacity={0.02} />
        </EffectComposer>

        <CameraController cameraPositionRef={cameraPositionRef} cameraTargetRef={cameraTargetRef} gameMode={gameMode} />

        <Sky sunPosition={[100, 20, 100]} turbidity={0.3} rayleigh={0.5} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Environment preset="sunset" />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} castShadow shadow-mapSize={[2048, 2048]} />

        <Physics gravity={GRAVITY}>
          {/* Realistic Island */}
          <RealisticIsland radius={ISLAND_RADIUS} />

          {/* Ocean */}
          <Ocean />

          {/* Trees and Rocks */}
          <NaturalElements />

          {/* Buildings */}
          {buildings.map((building) => (
            <Building key={building.id} building={building} />
          ))}

          {/* Build Preview */}
          {buildPreview && <BuildPreview building={buildPreview} />}

          {/* Characters */}
          {characters.map((character) => (
            <Character
              key={character.id}
              character={character}
              characterPositionsRef={characterPositionsRef}
              isActive={character.id === activeCharacterId}
              onClick={() => setActiveCharacterId(character.id)}
            />
          ))}

          {/* Enemies */}
          {enemies.map((enemy) => (
            <Enemy
              key={enemy.id}
              enemy={enemy}
              buildings={buildings}
              setBuildings={setBuildings}
              characters={characters}
              setCharacters={setCharacters}
              setEnemies={setEnemies}
              setResources={setResources}
            />
          ))}

          {/* Player Controller */}
          <PlayerController
            character={activeCharacter}
            characterId={activeCharacterId}
            gameMode={gameMode}
            buildMode={buildMode}
            moveCharacter={moveCharacter}
            updateBuildPreview={updateBuildPreview}
            placeBuilding={placeBuilding}
            cameraPositionRef={cameraPositionRef}
            cameraTargetRef={cameraTargetRef}
          />
        </Physics>

        {gameMode === "third-person" && (
          <OrbitControls
            target={new Vector3(...cameraTargetRef.current)}
            maxPolarAngle={Math.PI / 2 - 0.1}
            minDistance={5}
            maxDistance={20}
          />
        )}
      </Canvas>

      {/* Game UI */}
      <div className="absolute top-0 left-0 w-full p-4 pointer-events-none">
        <div className="flex justify-between items-start">
          {/* Game Info */}
          <div className="bg-black/70 p-3 rounded-lg text-white pointer-events-auto">
            <h2 className="text-xl font-bold text-yellow-400">Island Kingdom Defense</h2>
            <p>
              Wave: {waveNumber} {waveIncoming && <span className="text-red-500 animate-pulse"> - INCOMING!</span>}
            </p>
            <p>Resources: {resources}</p>
            <p>
              Time: {Math.floor(gameTime / 60)}:{(gameTime % 60).toString().padStart(2, "0")}
            </p>
          </div>

          {/* Character Info */}
          <div className="bg-black/70 p-3 rounded-lg text-white pointer-events-auto">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: activeCharacter.color }}></div>
              <h3 className="font-bold">
                {activeCharacter.name} - {activeCharacter.role}
              </h3>
            </div>
            <div className="mt-1 w-full bg-gray-700 h-2 rounded-full overflow-hidden">
              <div className="bg-green-500 h-full" style={{ width: `${activeCharacter.health}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2 pointer-events-none">
        {/* Character Selection */}
        <div className="bg-black/70 p-3 rounded-lg text-white flex flex-wrap gap-2 pointer-events-auto">
          {characters.map((char) => (
            <button
              key={char.id}
              className={`px-3 py-1 rounded ${char.id === activeCharacterId ? "bg-yellow-600" : "bg-gray-600"}`}
              onClick={() => setActiveCharacterId(char.id)}
            >
              {char.name}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="bg-black/70 p-3 rounded-lg text-white flex flex-wrap gap-2 pointer-events-auto">
          <button
            className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700"
            onClick={() => setGameMode(gameMode === "first-person" ? "third-person" : "first-person")}
          >
            {gameMode === "first-person" ? "Third Person" : "First Person"}
          </button>

          <button
            className={`px-3 py-1 rounded ${buildMode ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 hover:bg-gray-700"}`}
            onClick={() => setBuildMode(!buildMode)}
          >
            Build Mode: {buildMode ? "ON" : "OFF"}
          </button>

          {activeCharacter.id === 1 && (
            <button
              className="px-3 py-1 bg-purple-600 rounded hover:bg-purple-700"
              onClick={() => setShowTaskMenu(!showTaskMenu)}
            >
              Assign Tasks
            </button>
          )}
        </div>

        {/* Building Selection (only in build mode) */}
        {buildMode && (
          <div className="bg-black/70 p-3 rounded-lg text-white flex flex-wrap gap-2 pointer-events-auto">
            <p className="w-full font-bold">Select Building Type:</p>
            {buildingTypes.map((type) => (
              <button
                key={type.id}
                className={`px-3 py-1 rounded ${selectedBuildingType.id === type.id ? "bg-yellow-600" : "bg-gray-600"}`}
                onClick={() => setSelectedBuildingType(type)}
              >
                {type.name} (Cost: {type.cost})
              </button>
            ))}
          </div>
        )}

        {/* Task Assignment Menu */}
        {showTaskMenu && (
          <div className="bg-black/70 p-3 rounded-lg text-white pointer-events-auto">
            <h3 className="font-bold mb-2">Assign Task:</h3>
            <div className="grid grid-cols-2 gap-2">
              {characters
                .filter((c) => c.id !== 1)
                .map((char) => (
                  <div key={char.id} className="p-2 border border-gray-600 rounded">
                    <p className="font-bold">{char.name}</p>
                    <div className="mt-1 flex flex-col gap-1">
                      <button
                        className="px-2 py-1 bg-blue-600 rounded text-sm hover:bg-blue-700"
                        onClick={() => assignTask(char.id, "defend")}
                      >
                        Defend Castle
                      </button>
                      <button
                        className="px-2 py-1 bg-green-600 rounded text-sm hover:bg-green-700"
                        onClick={() => assignTask(char.id, "gather")}
                      >
                        Gather Resources
                      </button>
                      <button
                        className="px-2 py-1 bg-red-600 rounded text-sm hover:bg-red-700"
                        onClick={() => assignTask(char.id, "attack")}
                      >
                        Attack Enemies
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Controls Help */}
        <div className="bg-black/70 p-3 rounded-lg text-white pointer-events-auto">
          <p className="font-bold">Controls:</p>
          <p>• WASD - Move character</p>
          <p>• Mouse - Look around (first-person) / Rotate camera (third-person)</p>
          <p>• Left Click - Select character / Place building (in build mode)</p>
          <p>• Space - Jump</p>
        </div>
      </div>
    </div>
  )
}

// Camera controller component to handle camera updates
function CameraController({ cameraPositionRef, cameraTargetRef, gameMode }) {
  const { camera } = useThree()

  useFrame(() => {
    // Update camera position and target based on refs
    if (gameMode === "first-person") {
      camera.position.set(cameraPositionRef.current[0], cameraPositionRef.current[1], cameraPositionRef.current[2])
      camera.lookAt(cameraTargetRef.current[0], cameraTargetRef.current[1], cameraTargetRef.current[2])
    }
  })

  return null
}

// Realistic Island component with terrain
function RealisticIsland({ radius }) {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    type: "Static",
  }))

  // Create a more realistic island with elevation
  const terrainRef = useRef()

  // Use multiple textures for different parts of the island
  const grassTexture = useTexture("/placeholder.svg?key=19z5r")
  const sandTexture = useTexture("/sand-texture.png")

  // Set texture repeat
  grassTexture.repeat.set(10, 10)
  sandTexture.repeat.set(10, 10)

  grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping
  sandTexture.wrapS = sandTexture.wrapT = THREE.RepeatWrapping

  useFrame(({ clock }) => {
    if (terrainRef.current) {
      // Subtle terrain movement to simulate natural environment
      terrainRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.1) * 0.005
    }
  })

  return (
    <group ref={terrainRef}>
      {/* Main island body */}
      <mesh ref={ref} receiveShadow>
        <cylinderGeometry args={[radius, radius * 1.2, 2, 64]} />
        <meshStandardMaterial map={grassTexture} />
      </mesh>

      {/* Beach/shore ring */}
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <ringGeometry args={[radius - 2, radius, 64, 1]} />
        <meshStandardMaterial color="#f4e2c4" />
      </mesh>

      {/* Random terrain features - small hills and depressions */}
      {Array.from({ length: 15 }).map((_, i) => {
        const angle = (Math.PI * 2 * i) / 15
        const distance = radius * 0.6 * Math.random()
        const x = Math.sin(angle) * distance
        const z = Math.cos(angle) * distance
        const height = 0.2 + Math.random() * 0.8
        const width = 1 + Math.random() * 3

        return (
          <mesh key={i} position={[x, 0.5, z]} receiveShadow>
            <cylinderGeometry args={[width, width * 0.8, height, 16]} />
            <meshStandardMaterial map={grassTexture} />
          </mesh>
        )
      })}
    </group>
  )
}

// Ocean component with waves
function Ocean() {
  const oceanRef = useRef()
  const oceanMaterialRef = useRef()

  useFrame(({ clock }) => {
    if (oceanRef.current) {
      // Animate ocean waves
      const time = clock.getElapsedTime()
      oceanRef.current.position.y = Math.sin(time * 0.2) * 0.1 - 0.5

      if (oceanMaterialRef.current) {
        oceanMaterialRef.current.uniforms.time.value = time
      }
    }
  })

  // Custom shader for ocean waves
  const waveShader = {
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color("#1e65aa") },
    },
    vertexShader: `
      uniform float time;
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
        vec3 pos = position;
        
        // Add wave effect
        float wave = sin(pos.x * 0.5 + time) * 0.2 + 
                    sin(pos.z * 0.3 + time * 0.8) * 0.3;
        pos.y += wave;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying vec2 vUv;
      
      void main() {
        // Add depth-based color variation
        float depth = vUv.y * 0.5 + 0.5;
        vec3 finalColor = mix(color, vec3(0.0, 0.1, 0.2), depth);
        
        gl_FragColor = vec4(finalColor, 0.8);
      }
    `,
  }

  return (
    <mesh ref={oceanRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      <planeGeometry args={[ISLAND_RADIUS * 4, ISLAND_RADIUS * 4, 32, 32]} />
      <shaderMaterial ref={oceanMaterialRef} args={[waveShader]} transparent={true} side={THREE.DoubleSide} />
    </mesh>
  )
}

// Natural elements like trees and rocks
function NaturalElements() {
  // Generate positions for trees and rocks
  const elements = useMemo(() => {
    const items = []

    // Trees around the island
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20
      const distance = ISLAND_RADIUS * 0.7
      const x = Math.sin(angle) * distance
      const z = Math.cos(angle) * distance

      items.push({
        id: `tree-${i}`,
        type: "tree",
        position: [x, 1, z],
        scale: 0.8 + Math.random() * 0.4,
      })
    }

    // Random trees in the center
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2
      const distance = ISLAND_RADIUS * 0.4 * Math.random()
      const x = Math.sin(angle) * distance
      const z = Math.cos(angle) * distance

      items.push({
        id: `tree-center-${i}`,
        type: "tree",
        position: [x, 1, z],
        scale: 0.6 + Math.random() * 0.3,
      })
    }

    // Rocks
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2
      const distance = ISLAND_RADIUS * 0.8 * Math.random()
      const x = Math.sin(angle) * distance
      const z = Math.cos(angle) * distance

      items.push({
        id: `rock-${i}`,
        type: "rock",
        position: [x, 0.5, z],
        scale: 0.3 + Math.random() * 0.5,
        rotation: Math.random() * Math.PI,
      })
    }

    return items
  }, [])

  return (
    <group>
      {elements.map((element) => (
        <NaturalElement key={element.id} element={element} />
      ))}
    </group>
  )
}

// Individual tree or rock
function NaturalElement({ element }) {
  if (element.type === "tree") {
    return (
      <group position={element.position} scale={[element.scale, element.scale, element.scale]}>
        {/* Tree trunk */}
        <mesh position={[0, 1, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.3, 2, 8]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>

        {/* Tree foliage */}
        <mesh position={[0, 2.5, 0]} castShadow>
          <coneGeometry args={[1, 3, 8]} />
          <meshStandardMaterial color="#2E8B57" />
        </mesh>
      </group>
    )
  } else if (element.type === "rock") {
    return (
      <mesh
        position={element.position}
        rotation={[0, element.rotation, 0]}
        scale={[element.scale, element.scale, element.scale]}
        castShadow
        receiveShadow
      >
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#808080" roughness={0.8} />
      </mesh>
    )
  }

  return null
}

// Building component
function Building({ building }) {
  const [ref] = useBox(() => ({
    args: building.size,
    position: building.position,
    type: "Static",
  }))

  return (
    <group>
      <Box ref={ref} args={building.size} castShadow receiveShadow>
        <meshStandardMaterial color={building.color} />
      </Box>
      <Text
        position={[building.position[0], building.position[1] + building.size[1] / 2 + 0.5, building.position[2]]}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {building.type.charAt(0).toUpperCase() + building.type.slice(1)}
      </Text>

      {/* Health bar */}
      <group position={[building.position[0], building.position[1] + building.size[1] / 2 + 1, building.position[2]]}>
        <mesh position={[0, 0, 0]} scale={[1, 0.1, 0.1]}>
          <boxGeometry />
          <meshBasicMaterial color="#333333" />
        </mesh>
        <mesh position={[(building.health / 100 - 1) / 2, 0, 0]} scale={[building.health / 100, 0.08, 0.08]}>
          <boxGeometry />
          <meshBasicMaterial color={building.health > 70 ? "#00ff00" : building.health > 30 ? "#ffff00" : "#ff0000"} />
        </mesh>
      </group>
    </group>
  )
}

// Build preview component
function BuildPreview({ building }) {
  return (
    <Box args={building.size} position={building.position} castShadow receiveShadow>
      <meshStandardMaterial color={building.color} transparent opacity={0.5} />
    </Box>
  )
}

// Character component with proper orientation
function Character({ character, characterPositionsRef, isActive, onClick }) {
  const [ref, api] = useBox(() => ({
    mass: 1,
    position: character.position,
    args: [1, 2, 1],
    type: "Dynamic",
  }))

  // Use ref for position to avoid re-renders
  const positionRef = useRef(character.position)

  // Subscribe to position updates from physics
  useEffect(() => {
    const unsubscribe = api.position.subscribe((v) => {
      positionRef.current = [v[0], v[1], v[2]]
    })

    return unsubscribe
  }, [api.position])

  // Update position from ref
  useFrame(() => {
    if (characterPositionsRef.current[character.id]) {
      const newPos = characterPositionsRef.current[character.id].position
      api.position.set(newPos[0], newPos[1], newPos[2])
    }
  })

  // Keep character upright
  useEffect(() => {
    api.rotation.set(0, 0, 0)
  }, [api])

  return (
    <group onClick={onClick}>
      <Box ref={ref} args={[1, 2, 1]} castShadow>
        <meshStandardMaterial color={character.color} />
      </Box>

      {/* Head */}
      <Sphere
        position={[positionRef.current[0], positionRef.current[1] + 1.5, positionRef.current[2]]}
        args={[0.4, 16, 16]}
        castShadow
      >
        <meshStandardMaterial color={character.color} />
      </Sphere>

      <Text
        position={[positionRef.current[0], positionRef.current[1] + 2.2, positionRef.current[2]]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
        backgroundColor={isActive ? "#00000080" : "transparent"}
        padding={0.1}
      >
        {character.name}
      </Text>

      {/* Health bar */}
      <group position={[positionRef.current[0], positionRef.current[1] + 2.5, positionRef.current[2]]}>
        <mesh position={[0, 0, 0]} scale={[1, 0.1, 0.1]}>
          <boxGeometry />
          <meshBasicMaterial color="#333333" />
        </mesh>
        <mesh position={[(character.health / 100 - 1) / 2, 0, 0]} scale={[character.health / 100, 0.08, 0.08]}>
          <boxGeometry />
          <meshBasicMaterial
            color={character.health > 70 ? "#00ff00" : character.health > 30 ? "#ffff00" : "#ff0000"}
          />
        </mesh>
      </group>
    </group>
  )
}

// Enemy component
function Enemy({ enemy, buildings, setBuildings, characters, setCharacters, setEnemies, setResources }) {
  const [ref, api] = useBox(() => ({
    mass: 1,
    position: enemy.position,
    args: [1, 2, 1],
    type: "Dynamic",
  }))

  // Use ref for position to avoid re-renders
  const positionRef = useRef(enemy.position)
  const healthRef = useRef(enemy.health)

  // Subscribe to position updates from physics
  useEffect(() => {
    const unsubscribe = api.position.subscribe((v) => {
      positionRef.current = [v[0], v[1], v[2]]
    })

    return unsubscribe
  }, [api.position])

  useFrame(() => {
    // Move toward target
    const targetVector = new Vector3(...enemy.target)
    const currentPos = new Vector3(...positionRef.current)
    const direction = targetVector.sub(currentPos).normalize().multiplyScalar(enemy.speed)

    api.velocity.set(direction.x, 0, direction.z)

    // Check for collisions with buildings
    buildings.forEach((building) => {
      const buildingPos = new Vector3(...building.position)
      const distance = currentPos.distanceTo(buildingPos)

      if (distance < 3) {
        // Attack building
        setBuildings((prev) =>
          prev.map((b) => (b.id === building.id ? { ...b, health: Math.max(0, b.health - enemy.damage * 0.05) } : b)),
        )
      }
    })

    // Check for collisions with characters
    characters.forEach((character) => {
      const charPos = new Vector3(...character.position)
      const distance = currentPos.distanceTo(charPos)

      if (distance < 2) {
        // Attack character
        setCharacters((prev) =>
          prev.map((c) => (c.id === character.id ? { ...c, health: Math.max(0, c.health - enemy.damage * 0.05) } : c)),
        )

        // Character attacks back
        healthRef.current -= 0.5
        if (healthRef.current <= 0) {
          setEnemies((prev) => prev.filter((e) => e.id !== enemy.id))
          setResources((prev) => prev + 10) // Reward for killing enemy
        }
      }
    })

    // Update enemy position in the original object
    enemy.position = [...positionRef.current]
    enemy.health = healthRef.current
  })

  return (
    <group>
      <Box ref={ref} args={[1, 2, 1]} castShadow>
        <meshStandardMaterial color={enemy.color} />
      </Box>

      {/* Head */}
      <Sphere
        position={[positionRef.current[0], positionRef.current[1] + 1.5, positionRef.current[2]]}
        args={[0.4, 16, 16]}
        castShadow
      >
        <meshStandardMaterial color={enemy.color} />
      </Sphere>

      <Text
        position={[positionRef.current[0], positionRef.current[1] + 2.2, positionRef.current[2]]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
        backgroundColor="#00000080"
        padding={0.1}
      >
        Enemy
      </Text>

      {/* Health bar */}
      <group position={[positionRef.current[0], positionRef.current[1] + 2.5, positionRef.current[2]]}>
        <mesh position={[0, 0, 0]} scale={[1, 0.1, 0.1]}>
          <boxGeometry />
          <meshBasicMaterial color="#333333" />
        </mesh>
        <mesh position={[(enemy.health / 100 - 1) / 2, 0, 0]} scale={[enemy.health / 100, 0.08, 0.08]}>
          <boxGeometry />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      </group>
    </group>
  )
}

// Player controller component with improved first/third person camera
function PlayerController({
  character,
  characterId,
  gameMode,
  buildMode,
  moveCharacter,
  updateBuildPreview,
  placeBuilding,
  cameraPositionRef,
  cameraTargetRef,
}) {
  const { camera } = useThree()
  const keysPressed = useRef({})
  const mousePosition = useRef({ x: 0, y: 0 })
  const characterRotation = useRef(0)
  const [isJumping, setIsJumping] = useState(false)
  const jumpVelocity = useRef(0)
  const lastUpdateTime = useRef(0)
  const characterPosRef = useRef([...character.position])

  // Set up key listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      keysPressed.current[e.key.toLowerCase()] = true

      // Jump when space is pressed
      if (e.key === " " && !isJumping) {
        jumpVelocity.current = 0.3
        setIsJumping(true)
      }
    }

    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false
    }

    const handleMouseMove = (e) => {
      if (gameMode === "first-person") {
        mousePosition.current.x = e.movementX
        mousePosition.current.y = e.movementY

        // Update character rotation based on mouse movement
        characterRotation.current -= e.movementX * ROTATION_SPEED
      }
    }

    const handleMouseDown = (e) => {
      if (e.button === 0 && buildMode) {
        // Left click in build mode
        // Get mouse position in 3D space
        const raycaster = new THREE.Raycaster()
        const mouse = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1,
        )

        raycaster.setFromCamera(mouse, camera)

        // Calculate intersection with ground plane
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
        const intersection = new THREE.Vector3()
        raycaster.ray.intersectPlane(groundPlane, intersection)

        // Place building at intersection point with grid snapping
        if (intersection) {
          // Snap to grid
          const x = Math.round(intersection.x / BUILD_GRID_SIZE) * BUILD_GRID_SIZE
          const z = Math.round(intersection.z / BUILD_GRID_SIZE) * BUILD_GRID_SIZE
          placeBuilding([x, 1, z])
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mousedown", handleMouseDown)

    // Lock pointer for first-person mode
    if (gameMode === "first-person") {
      document.body.requestPointerLock && document.body.requestPointerLock()
    } else {
      document.exitPointerLock && document.exitPointerLock()
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mousedown", handleMouseDown)
    }
  }, [gameMode, buildMode, camera, placeBuilding, isJumping, setIsJumping])

  // Update character position ref when character changes
  useEffect(() => {
    characterPosRef.current = [...character.position]
  }, [character])

  useFrame(({ clock }) => {
    // Throttle updates to avoid excessive state changes
    const currentTime = clock.getElapsedTime()
    if (currentTime - lastUpdateTime.current < 0.05) return
    lastUpdateTime.current = currentTime

    // Handle character movement
    const direction = new Vector3(0, 0, 0)
    const characterPos = new Vector3(...characterPosRef.current)

    // Calculate forward and right vectors based on camera or character rotation
    let forward, right

    if (gameMode === "first-person") {
      // In first-person, use character's rotation
      forward = new Vector3(0, 0, -1).applyAxisAngle(new Vector3(0, 1, 0), characterRotation.current)
      right = new Vector3(1, 0, 0).applyAxisAngle(new Vector3(0, 1, 0), characterRotation.current)
    } else {
      // In third-person, use camera's rotation
      forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    }

    // Zero out y component for horizontal movement
    forward.y = 0
    forward.normalize()
    right.y = 0
    right.normalize()

    // Apply movement based on keys pressed
    if (keysPressed.current["w"]) direction.add(forward)
    if (keysPressed.current["s"]) direction.sub(forward)
    if (keysPressed.current["a"]) direction.sub(right)
    if (keysPressed.current["d"]) direction.add(right)

    // Normalize and scale by speed
    if (direction.length() > 0) {
      direction.normalize().multiplyScalar(MOVEMENT_SPEED * character.speed)
    }

    // Handle jumping
    if (isJumping) {
      characterPos.y += jumpVelocity.current
      jumpVelocity.current -= 0.01 // Gravity

      if (characterPos.y <= 1) {
        characterPos.y = 1
        setIsJumping(false)
      }
    }

    // Update character position
    const newPosition = new Vector3(characterPos.x + direction.x, characterPos.y, characterPos.z + direction.z)

    // Keep character within island bounds
    const distanceFromCenter = Math.sqrt(newPosition.x * newPosition.x + newPosition.z * newPosition.z)
    if (distanceFromCenter > ISLAND_RADIUS - 1) {
      const angle = Math.atan2(newPosition.z, newPosition.x)
      newPosition.x = (ISLAND_RADIUS - 1) * Math.cos(angle)
      newPosition.z = (ISLAND_RADIUS - 1) * Math.sin(angle)
    }

    // Update character position ref
    characterPosRef.current = [newPosition.x, newPosition.y, newPosition.z]

    // Update character position and rotation
    moveCharacter(characterId, [newPosition.x, newPosition.y, newPosition.z], characterRotation.current)

    // Update camera position in first-person mode
    if (gameMode === "first-person") {
      const eyeHeight = 1.7 // Eye level
      const newCamPos = [newPosition.x, newPosition.y + eyeHeight, newPosition.z]

      cameraPositionRef.current = newCamPos

      // Calculate look target based on rotation
      const lookDir = new Vector3(0, 0, -1).applyAxisAngle(new Vector3(0, 1, 0), characterRotation.current)
      const targetPos = [newPosition.x + lookDir.x, newPosition.y + eyeHeight, newPosition.z + lookDir.z]

      cameraTargetRef.current = targetPos
    } else {
      // In third-person, update the target for OrbitControls
      cameraTargetRef.current = [newPosition.x, newPosition.y, newPosition.z]
      cameraPositionRef.current = [newPosition.x, newPosition.y + 10, newPosition.z + 10]
    }

    // Update build preview position
    if (buildMode) {
      // Cast ray from camera to ground
      const raycaster = new THREE.Raycaster()
      raycaster.set(camera.position, new Vector3(0, -1, 0))

      // Create a virtual ground plane
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const intersection = new THREE.Vector3()

      // Get intersection point
      if (raycaster.ray.intersectPlane(groundPlane, intersection)) {
        updateBuildPreview([intersection.x, 1, intersection.z])
      }
    }
  })

  return null
}
