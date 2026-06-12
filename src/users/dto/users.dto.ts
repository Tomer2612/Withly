import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

// Owner bank account for monthly payout transfers. All fields stored as
// strings (codes keep their shape); the bank field is the canonical
// Bank-of-Israel code chosen in the frontend dropdown.
export class SaveBankAccountDto {
  @IsString() @MinLength(2) @MaxLength(100)
  accountHolderName!: string;

  @IsString() @MinLength(1) @MaxLength(10)
  bank!: string;

  @IsString() @MinLength(1) @MaxLength(10)
  branchNumber!: string;

  @IsString() @MinLength(1) @MaxLength(30)
  accountNumber!: string;

  @IsString() @MinLength(5) @MaxLength(15)
  idNumber!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;
}

export class ToggleOnlineStatusDto {
  @IsBoolean()
  showOnline!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional() @IsBoolean() notifyLikes?: boolean;
  @IsOptional() @IsBoolean() notifyComments?: boolean;
  @IsOptional() @IsBoolean() notifyFollows?: boolean;
  @IsOptional() @IsBoolean() notifyNewPosts?: boolean;
  @IsOptional() @IsBoolean() notifyMentions?: boolean;
  @IsOptional() @IsBoolean() notifyCommunityJoins?: boolean;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  newPassword!: string;
}

export class AddPaymentMethodDto {
  // Last 4 of a card number — exactly 4 digits.
  @IsString()
  @Matches(/^\d{4}$/, { message: 'cardLastFour must be exactly 4 digits' })
  cardLastFour!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  cardBrand?: string;
}
