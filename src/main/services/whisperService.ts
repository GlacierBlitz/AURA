import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Service for transcribing audio using OpenAI Whisper API
 */
export class WhisperService {
  private openai: OpenAI | null = null;
  private apiKey: string | null = null;

  /**
   * Configure the Whisper service with OpenAI API key
   */
  public configure(apiKey: string): void {
    this.apiKey = apiKey;
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
    console.log('Whisper service configured');
  }

  /**
   * Transcribe audio data to text using Whisper API
   */
  public async transcribe(audioData: Uint8Array, mimeType: string): Promise<string> {
    if (!this.openai || !this.apiKey) {
      throw new Error('Whisper service not configured. Please set OpenAI API key.');
    }

    try {
      // Whisper API requires a file, so write audio to temp file
      const tempDir = os.tmpdir();
      const extension = this.getExtensionFromMimeType(mimeType);
      const tempFilePath = path.join(tempDir, `audio-${Date.now()}.${extension}`);
      
      // Write audio data to temp file
      fs.writeFileSync(tempFilePath, audioData);
      console.log(`Wrote audio to temp file: ${tempFilePath}, size: ${audioData.length} bytes`);

      try {
        // Call Whisper API
        const transcription = await this.openai.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath),
          model: 'whisper-1',
          language: 'en', // Can be made configurable
        });

        console.log('Whisper transcription successful:', transcription.text);
        return transcription.text;
      } finally {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFilePath);
          console.log('Cleaned up temp audio file');
        } catch (cleanupError) {
          console.error('Failed to clean up temp file:', cleanupError);
        }
      }
    } catch (error: any) {
      console.error('Whisper transcription error:', error);
      if (error.response?.status === 401) {
        throw new Error('Invalid OpenAI API key');
      } else if (error.response?.status === 429) {
        throw new Error('OpenAI API rate limit exceeded');
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('Unable to connect to OpenAI API');
      } else {
        throw new Error(`Transcription failed: ${error.message}`);
      }
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/mp3': 'mp3',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'mp4',
      'audio/m4a': 'm4a',
    };

    return mimeToExt[mimeType] || 'webm';
  }
}
