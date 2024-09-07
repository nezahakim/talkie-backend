package stream

import (
  "io"
  "sync"

  "github.com/pion/webrtc/v3"
  "github.com/nezahakim/talkie-backend/pkg/logger"
)

type AudioStream struct {
  peerConnection *webrtc.PeerConnection
  audioTrack     *webrtc.TrackLocalStaticSample
  mutex          sync.Mutex
  logger         *logger.Logger
}

func NewAudioStream(logger *logger.Logger) (*AudioStream, error) {
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

  audioTrack, err := webrtc.NewTrackLocalStaticSample(webrtc.RTPCodecCapability{MimeType: "audio/opus"}, "audio", "pion")
  if err != nil {
    return nil, err
  }

  if _, err = peerConnection.AddTrack(audioTrack); err != nil {
    return nil, err
  }

  return &AudioStream{
    peerConnection: peerConnection,
    audioTrack:     audioTrack,
    logger:         logger,
  }, nil
}

func (as *AudioStream) CreateOffer() (string, error) {
  offer, err := as.peerConnection.CreateOffer(nil)
  if err != nil {
    return "", err
  }

  err = as.peerConnection.SetLocalDescription(offer)
  if err != nil {
    return "", err
  }

  return offer.SDP, nil
}

func (as *AudioStream) HandleAnswer(answerSDP string) error {
  answer := webrtc.SessionDescription{
    Type: webrtc.SDPTypeAnswer,
    SDP:  answerSDP,
  }

  return as.peerConnection.SetRemoteDescription(answer)
}

func (as *AudioStream) WriteAudio(reader io.Reader) error {
  buffer := make([]byte, 1024)
  for {
    n, err := reader.Read(buffer)
    if err == io.EOF {
      return nil
    }
    if err != nil {
      return err
    }

    as.mutex.Lock()
    if err := as.audioTrack.WriteSample(webrtc.MediaSample{Data: buffer[:n], Duration: 20}); err != nil {
      as.mutex.Unlock()
      return err
    }
    as.mutex.Unlock()
  }
}

func (as *AudioStream) Close() error {
  return as.peerConnection.Close()
}
