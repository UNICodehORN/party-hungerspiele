<?php
date_default_timezone_set('Europe/Berlin');

class GameController
{
    private $dataStorage;
    private $answerStorage;
    private $roundStorage;
    private $defaultTeams = ["Tisch1", "Tisch2", "Tisch3", "Tisch4", "Tisch5", "Tisch6", "Tisch7", "Tisch8", "Tisch9", "Tisch10"];

    private $rounds = [];

    public function __construct()
    {
        $this->dataStorage = __DIR__ . '/../data/game.json';
        $this->answerStorage = __DIR__ . '/../data/answer.json';
        $this->roundStorage = __DIR__ . '/../data/rounds.json';

        $roundFile = file_exists($this->roundStorage)
            ? $this->roundStorage
            : __DIR__ . '/../data/rounds.example.json';
        $roundsJson = file_get_contents($roundFile);
        if ($roundsJson === false) {
            throw new RuntimeException('Unable to read game rounds configuration.');
        }
        $this->rounds = json_decode($roundsJson, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($this->rounds) || count($this->rounds) === 0) {
            throw new RuntimeException('Game rounds configuration must contain at least one round.');
        }
        foreach ($this->rounds as $round) {
            if (
                !isset($round['module'], $round['intro'], $round['elements']) ||
                !is_array($round['elements']) ||
                count($round['elements']) === 0
            ) {
                throw new RuntimeException('Each game round must define a module, intro, and at least one element.');
            }
        }

        if (!file_exists($this->dataStorage) && !copy(__DIR__ . '/../data/game.example.json', $this->dataStorage)) {
            throw new RuntimeException('Unable to initialize game state. Ensure the data directory is writable.');
        }
        if (!file_exists($this->answerStorage) && file_put_contents($this->answerStorage, '[]', LOCK_EX) === false) {
            throw new RuntimeException('Unable to initialize answer storage. Ensure the data directory is writable.');
        }
    }

    // === PUBLIC FUNCTIONS ===

    // Start a new game, initialize teams and reset state

    public function startGame($teams = null)
    {
        $this->resetGame();
        if ($teams === null) {
            $teams = $this->defaultTeams;
        }

        $data = [
            'gameState' => [
                'round' => 0,
                'roundProgress' => 0,
                'status' => 'waiting'
            ],
            'currentRound' => [],
            'teams' => []
        ];

        foreach ($teams as $team) {
            $data['teams'][$team] = [
                'players' => []
            ];
        }

        $this->saveData($data);
    }

    // Add a new player with 0 points
    public function addPlayer($playerName, $teamName)
    {
        if (!preg_match('/^[a-zA-Z0-9äöüÄÖÜß\s]+$/u', $playerName) ||
            !preg_match('/^[a-zA-Z0-9äöüÄÖÜß\s]+$/u', $teamName)) {
            error_log("Invalid characters in player or team name");
            return;
        }

        $data = $this->loadData();

        if (!isset($data['teams'][$teamName])) {
            error_log("Team $teamName does not exist");
            return;
        }

        // Spieler hinzufügen falls nicht vorhanden
        foreach ($data['teams'][$teamName]['players'] as $p) {
            if ($p['name'] === $playerName) {
                return; // existiert schon
            }
        }

        $data['teams'][$teamName]['players'][] = [
            'name' => $playerName,
            'points' => 0
        ];

        $this->saveData($data);
    }

    // Add points for a specific player
    public function addPointsForPlayer($teamName, $playerName, $points)
    {
        $data = $this->loadData();

        // Prüfen, ob das Team existiert
        if (!isset($data['teams'][$teamName])) {
            error_log("Team $teamName not found");
            return;
        }

        foreach ($data['teams'][$teamName]['players'] as &$player) {
            if ($player['name'] === $playerName) {
                $player['points'] += $points;
                $this->saveData($data);
                return;
            }
        }

        error_log("Player $playerName not found in team $teamName");
    }


    // Get total points for a team
    public function getHighscoreForTeam($teamName)
    {
        $data = $this->loadData();

        if (!isset($data['teams'][$teamName])) {
            error_log("Team $teamName not found");
            return -1;
        }

        return array_sum(array_column($data['teams'][$teamName]['players'], 'points'));
    }

    // Get all highscores, sorted descending (teams)
    public function getHighscoreAllTeams()
    {
        $data = $this->loadData();
        $result = [];

        foreach ($data['teams'] as $teamName => $team) {
            $result[] = [
                'team' => $teamName,
                'points' => array_sum(array_column($team['players'], 'points'))
            ];
        }

        usort($result, function ($a, $b) {
            return $b['points'] - $a['points'];
        });

        return $result;
    }

    // Get global player highscore (all players across all teams)
    public function getHighscoreAllPlayers($limit = 10)
    {
        $data = $this->loadData();
        $players = [];

        foreach ($data['teams'] as $teamName => $team) {
            foreach ($team['players'] as $player) {
                $players[] = [
                    'name' => $player['name'],
                    'team' => $teamName,
                    'points' => $player['points']
                ];
            }
        }

        usort($players, function ($a, $b) {
            return $b['points'] - $a['points'];
        });

        return array_slice($players, 0, $limit);
    }

    // Get current game state
    public function getGameState()
    {
        return $this->loadData();
    }

    // Update game state
    public function updateGameState($round = null, $roundProgress = null, $status = null)
    {
        $data = $this->loadData();

        if ($round !== null) $data['gameState']['round'] = (int)$round;
        if ($roundProgress !== null) $data['gameState']['roundProgress'] = (int)$roundProgress;
        if ($status !== null) $data['gameState']['status'] = $status;

        $this->saveData($data);
    }

    public function progressGame()
    {
        // End possible open round
        $this->endRound();
        $currentState = $this->getGameState();
        $round = $currentState['gameState']['round'];
        $roundProgress = $currentState['gameState']['roundProgress'];

        $maxRounds = sizeof($this->rounds);
        $maxStepsInRound = 0;
        if ($round > 0)
            $maxStepsInRound = sizeof($this->rounds[$round - 1]["elements"]);

        // Wait for players...
        if ($round === 0 && $roundProgress < 1) {
            $this->updateGameState(0, $roundProgress + 1, "waiting for players...");
        } // Start first round
        else if ($round === 0 && $roundProgress == 1 && $maxRounds > 0) {
            $this->loadLevel(1, 0);
            $this->updateGameState(1, 0, "start game...");
        } // Next level
        elseif ($maxStepsInRound < $roundProgress + 1 && $maxRounds >= $round + 1) {
            $this->loadLevel($round + 1, 0);
            $this->updateGameState($round + 1, 0, "next round " . ($round + 1) . "/" . $maxRounds);
        } // Progress level
        elseif ($maxStepsInRound >= $roundProgress + 1) {
            $this->loadLevel($round, $roundProgress + 1);
            $this->updateGameState($round, $roundProgress + 1, "progress round " . ($roundProgress + 1) . "/" . $maxStepsInRound);
        } else {
            $this->updateGameState($round, $roundProgress, "game ends");
        }
    }

    public function resetGame()
    {
        $this->updateGameState(0, 0, "reset game...");
        $data = $this->loadData();
        // Reset current Round
        $data["currentRound"] = [];
        // Reset points
        foreach ($data['teams'] as $teamName => $team) {
            foreach ($team['players'] as $playerName => $player) {
                $data['teams'][$teamName]['players'][$playerName]['points'] = 0;
            }
        }
        $this->saveData($data);
        // Reset answers
        $json = json_encode([], JSON_PRETTY_PRINT);
        file_put_contents($this->answerStorage, $json, LOCK_EX);
        return $this->getGameState();
    }

    public function addAnswer($answer, $playerName, $team)
    {
        $currentRound = $this->getGameState()["currentRound"];
        $player = $this->getPlayerIdByName($playerName, $team);
        if ($this->validatePlayer($team, $player) && isset($currentRound["until"])) {
            $until = $currentRound["until"];
            // Check if answer is valid
            $validAnswer = false;
            if (time() <= strtotime($until) + 3) {
                $validAnswer = true;
            }
            $currentRound["validAnswer"] = $validAnswer;

            if ($validAnswer) {
                return $this->saveAnswer($answer, $player, $team);
            }
        }
        echo "ok";
        return false;
    }

    public function toggleHighscore()
    {
        $state = $this->getGameState();
        if (isset($state["gameState"]["displayHighscore"]) && $state["gameState"]["displayHighscore"] === true) {
            $state["gameState"]["displayHighscore"] = false;
        } else {
            $state["gameState"]["displayHighscore"] = true;
        }
        $this->saveData($state);
        return $this->getGameState();
    }

    public function endRound()
    {
        // Load answers
        $currentRound = $this->getGameState()["currentRound"];
        $answers = json_decode(file_get_contents($this->answerStorage), true);

        if (empty($answers)) {
            return $this->getGameState();
        }

        $module = $this->rounds[$currentRound["round"] - 1]["module"];

        // -------------------------
        // PHOTO MODUL
        // -------------------------
        if ($module === "photo") {
            $correctAnswer = $currentRound["element"]["answer"];
            $awardFastest = true;

            foreach ($answers as $teamName => $team) {
                $playerInTeam = sizeof($team);
                foreach ($team as $playerName => $answer) {
                    if ($playerName != "days_sum") {
                        $days = $this->calculate_points_module_photo($correctAnswer, $answer);
                        if (!isset($answers[$teamName]["days_sum"])) {
                            $answers[$teamName]["days_sum"] = $days;
                        } else {
                            $answers[$teamName]["days_sum"] += $days;
                        }
                        if ($awardFastest) {
                            $answers[$teamName]["points"] = 10;
                            $awardFastest = false;
                        }
                    }
                }
                $answers[$teamName]["days_sum"] = round($answers[$teamName]["days_sum"] / $playerInTeam, 0);
                $answers[$teamName]["player"] = $playerInTeam;
            }

            // Sort Asc by days_sum
            uasort($answers, function ($a, $b) {
                return $a['days_sum'] <=> $b['days_sum'];
            });

            // Give Points
            $points = 100;
            foreach ($answers as $teamName => $team) {
                if (!isset($answers[$teamName]["points"])) {
                    $answers[$teamName]["points"] = $points;
                } else {
                    $answers[$teamName]["points"] += $points;
                }
                $points -= 10;
            }

            // Store points...
            $gameState = $this->getGameState();
            foreach ($answers as $teamName => $team) {
                $pointsPerPlayer = round($team["points"] / $team["player"], 0);
                foreach ($team as $playerName => $player) {
                    if (isset($gameState["teams"][$teamName]["players"][$playerName]["points"])) {
                        $gameState["teams"][$teamName]["players"][$playerName]["points"] += $pointsPerPlayer;
                    }
                }
            }

            // Save and reset
            file_put_contents($this->dataStorage, json_encode($gameState, JSON_PRETTY_PRINT), LOCK_EX);
            file_put_contents($this->answerStorage, '[]', LOCK_EX);
            return $this->getGameState();
        }

        // -------------------------
        // QUIZ MODUL (mit Antwort-IDs)
        // -------------------------
        else if ($module === "quiz") {
            $correctAnswer = (int)$currentRound["element"]["correct_answer"];
            $gameState = $this->getGameState();

            foreach ($answers as $teamName => $answerList) {
                $playerInTeam = 0;
                $correctCount = 0;
                $playerSubmits = 0;

                // Spieler zählen und richtige Antworten ermitteln
                foreach ($answerList as $playerName => $answer) {
                    $playerSubmits++;
                    if ($playerName !== "points") {
                        $playerInTeam++;
                        if ((int)$answer === $correctAnswer) {
                            $correctCount++;
                        }
                    }
                }

                // Punkte für das Team berechnen
                $teamPoints = 0;
                if ($playerInTeam > 0) {
                    $ratio = $correctCount / $playerInTeam;
                    $teamPoints = round($ratio * 10, 0); // max. 10 Punkte
                }


                $pointsPerPlayer = round($teamPoints / $playerSubmits, 0);
                foreach ($answerList as $playerName => $answer) {
                    if (isset($gameState["teams"][$teamName]["players"][$playerName]["points"])) {
                        $gameState["teams"][$teamName]["players"][$playerName]["points"] += $pointsPerPlayer;
                    }
                }
            }


            // Save and reset
            file_put_contents($this->dataStorage, json_encode($gameState, JSON_PRETTY_PRINT), LOCK_EX);
            file_put_contents($this->answerStorage, '[]', LOCK_EX);
            return $this->getGameState();
        }

        // -------------------------
        // UNKNOWN MODUL
        // -------------------------
        else {
            return ["no module found."];
        }
    }


    // === PRIVATE HELPERS ===

    private function calculate_points_module_photo($correctAnswer, $answer)
    {
        $correctDate = new DateTime($correctAnswer);
        $answerDate = new DateTime($answer);

        $interval = $correctDate->diff($answerDate);

        return (int)$interval->format('%a');
    }

    private function getPlayerIdByName($name, $team)
    {
        $state = $this->getGameState();
        foreach ($state["teams"][$team]["players"] as $playerId => $player) {
            if ($player["name"] == $name) {
                return $playerId;
            }
        }
        return -1;
    }

    private function validatePlayer($team, $player)
    {
        $state = $this->getGameState();
        $teams = $state["teams"];
        if (isset($teams[$team]) && isset($teams[$team]["players"][$player])) {
            return true;
        }
        return false;
    }

    private function loadLevel($lvlNr, $progress)
    {
        $data = $this->loadData();
        $until = date("Y-m-d H:i:s", time());
        if ($progress > 0)
            $until = date("Y-m-d H:i:s", time() + 30);
        $output = [
            "round" => $lvlNr,
            "roundProgress" => $progress,
            "module" => $this->rounds[$lvlNr - 1]["module"],
            "intro" => $this->rounds[$lvlNr - 1]["intro"],
            "intro_pl" => $this->rounds[$lvlNr - 1]["intro_pl"] ?? "",
            "intro_pt" => $this->rounds[$lvlNr - 1]["intro_pt"] ?? "",
            "element" => $progress > 0 ? $this->rounds[$lvlNr - 1]["elements"][$progress - 1] : null,
            "until" => $until
        ];
        $data["currentRound"] = $output;
        $this->saveData($data);
    }

    private function loadData()
    {
        if (!file_exists($this->dataStorage)) {
            return ['teams' => [], 'gameState' => ['round' => -1, 'roundProgress' => -1, 'status' => 'waiting']];
        }

        $json = file_get_contents($this->dataStorage);
        $data = json_decode($json, true);
        if (!$data) {
            return ['teams' => [], 'gameState' => ['round' => -1, 'roundProgress' => -1, 'status' => 'waiting']];
        }

        return $data;
    }

    private function saveData($data)
    {
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        file_put_contents($this->dataStorage, $json, LOCK_EX);
    }

    private function saveAnswer($answer, $playerKey, $team)
    {
        $player = (string)$playerKey;

        if (!file_exists($this->answerStorage)) {
            $data = [
                $team => [$player => $answer]
            ];
            $json = json_encode($data, JSON_PRETTY_PRINT);
            return file_put_contents($this->answerStorage, $json, LOCK_EX);
        } else {
            $json = file_get_contents($this->answerStorage);
            $data = json_decode($json, true);
            if (!isset($data[$team][$player])) {
                $data[$team][$player . "###"] = $answer;
                $json = json_encode($data, JSON_PRETTY_PRINT);
                $json = str_replace("###", "", $json);
                return file_put_contents($this->answerStorage, $json, LOCK_EX);
            } else
                return false;
        }
    }
}

?>
