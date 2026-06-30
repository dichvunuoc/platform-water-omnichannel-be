import { IsString, IsNotEmpty } from 'class-validator';

export class ClassifyImageDto {
  @IsString()
  @IsNotEmpty()
  imageUrl!: string;
}

export class TranscribeAudioDto {
  @IsString()
  @IsNotEmpty()
  audioUrl!: string;
}

export class ClassifyIntentDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}
