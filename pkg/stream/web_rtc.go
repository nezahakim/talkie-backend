package stream

import (
  "encoding/json"
  "errors"
  "sync"

  "github.com/pion/webrtc/v3"
  "github.com/nezahakim/talkie-backend/pkg/logger"
)

type WebRTCManager struct {
  peerConnections map[string]*webrtc.PeerConnection
  mutex           sync.RWMutex
  logger          *logger.Logger
}

func NewWebRTCManager(logger *logger.Logger) *WebRTCManager {
  return &WebRTCManager{
    peerConnections: make(map[string]*webrtc.PeerConnection),
    logger:          logger,
  }
}

func (wm *WebRTCManager) CreatePeerConnection(userID string) (*webrtc.PeerConnection, error) {
  config := webrtc.Configuration{
    ICEServers: []webrtc.ICEServer{
      {
        URLs: []string{"stun:stun.l.google.com:19302"},
      },
    },
  }

  peerConnection, err := webrtc.NewPeerConnection(config)
  if err != nil {
    return nil, err
  }

  wm.mutex.Lock()
  wm.peerConnections[userID] = peerConnection
  wm.mutex.Unlock()

  return peerConnection, nil
}

func (wm *WebRTCManager) HandleOffer(userID string, offerSDP string) (string, error) {
  wm.mutex.RLock()
  peerConnection, ok := wm.peerConnections[userID]
  wm.mutex.RUnlock()

  if !ok {
    return "", errors.New("peer connection not found")
  }

  offer := webrtc.SessionDescription{
    Type: webrtc.SDPTypeOffer,
    SDP:  offerSDP,
  }

  err := peerConnection.SetRemoteDescription(offer)
  if err != nil {
    return "", err
  }

  answer, err := peerConnection.CreateAnswer(nil)
  if err != nil {
    return "", err
  }

  err = peerConnection.SetLocalDescription(answer)
  if err != nil {
    return "", err
  }

  return answer.SDP, nil
}

func (wm *WebRTCManager) HandleICECandidate(userID string, candidateJSON string) error {
  wm.mutex.RLock()
  peerConnection, ok := wm.peerConnections[userID]
  wm.mutex.RUnlock()

  if !ok {
    return errors.New("peer connection not found")
  }

  var candidate webrtc.ICECandidateInit
  err := json.Unmarshal([]byte(candidateJSON), &candidate)
  if err != nil {
    return err
  }

  return peerConnection.AddICECandidate(candidate)
}

func (wm *WebRTCManager) ClosePeerConnection(userID string) error {
  wm.mutex.Lock()
  defer wm.mutex.Unlock()

  peerConnection, ok := wm.peerConnections[userID]
  if !ok {
    return errors.New("peer connection not found")
  }

  err := peerConnection.Close()
  if err != nil {
    return err
  }

  delete(wm.peerConnections, userID)
  return nil
}
