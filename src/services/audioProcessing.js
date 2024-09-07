const { Lame } = require('node-lame');
const { Readable } = require('stream');

exports.processAudio = async (audioData) => {
  try {
    // Convert audioData to a Buffer if it's not already
    const audioBuffer = Buffer.from(audioData);

    // Create a readable stream from the buffer
    const readableStream = new Readable();
    readableStream.push(audioBuffer);
    readableStream.push(null);

    // Set up Lame for MP3 encoding
    const encoder = new Lame({
      output: 'buffer',
      bitrate: 128,
    }).setBuffer(readableStream);

    // Encode to MP3
    const mp3Buffer = await encoder.encode();

    // Here you could add more processing steps like noise reduction or echo cancellation
    // For now, we'll just return the MP3 buffer
    return mp3Buffer;
  } catch (error) {
    console.error('Error processing audio:', error);
    throw error;
  }
};
