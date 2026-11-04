<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'GameController.php';

$controller = new GameController();

// Simple GET routing
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'startGame':
        // Optional teams as JSON array string
        $teams = isset($_GET['teams']) ? json_decode($_GET['teams'], true) : null;
        $controller->startGame($teams);
        echo json_encode(['status' => 'ok', 'message' => 'Game started']);
        break;

    case 'addPlayer':
        $player = $_GET['player'] ?? '';
        $team   = $_GET['team'] ?? '';
        $controller->addPlayer($player, $team);
        echo json_encode(['status' => 'ok', 'message' => "Player $player added to $team"]);
        break;

    case 'addPoints':
        $team = $_GET['team'] ?? '';
        $player = $_GET['player'] ?? '';
        $points = isset($_GET['points']) ? intval($_GET['points']) : 0;

        if ($team && $player) {
            $controller->addPointsForPlayer($team, $player, $points);
            echo json_encode(['status' => 'ok', 'message' => "Added $points points to $player in $team"]);
        } else {
            echo json_encode(['status' => 'error', 'message' => "Team or player not specified"]);
        }
        break;


    case 'getHighscore':
        $team = $_GET['team'] ?? '';
        $score = $controller->getHighscoreForTeam($team);
        echo json_encode(['team' => $team, 'points' => $score]);
        break;

    case 'getHighscoreAllTeams':
        $scores = $controller->getHighscoreAllTeams();
        echo json_encode($scores);
        break;

    case 'getHighscoreAllPlayers':
        $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
        $scores = $controller->getHighscoreAllPlayers($limit);
        echo json_encode($scores);
        break;

    case 'getGameState':
        $state = $controller->getGameState();
        echo json_encode($state);
        break;

    case 'updateGameState':
        $round   = $_GET['round']   ?? null;
        $progress= $_GET['progress']?? null;
        $status  = $_GET['status']  ?? null;
        $controller->updateGameState($round, $progress, $status);
        echo json_encode(['status' => 'ok', 'message' => 'Game state updated']);
        break;

    case 'progressGame':
        $controller->progressGame();
        $state = $controller->getGameState();
        echo json_encode($state);
        break;

    case 'resetGame':
        echo json_encode($controller->resetGame());
        break;

    case 'addAnswer':
        $player   = $_GET['player']   ?? null;
        $team= $_GET['team']?? null;
        $answer  = $_GET['answer']  ?? null;
        echo json_encode($controller->addAnswer($answer, $player, $team));
        break;

    case 'toggleHighscore':
        echo json_encode($controller->toggleHighscore());
        break;

    case 'endRound':
        echo json_encode($controller->endRound());
        break;

    default:
        echo json_encode(['status' => 'error', 'message' => 'Unknown action']);
        break;
}
