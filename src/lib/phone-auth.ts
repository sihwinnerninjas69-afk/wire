import { supabase } from './supabase';

export interface PhoneAuthResult {
  success: boolean;
  message: string;
  userId?: string;
}

export const sendOTP = async (phoneNumber: string): Promise<PhoneAuthResult> => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    const { error } = await supabase
      .from('otp_codes')
      .insert({
        phone_number: phoneNumber,
        otp_code: otp,
        expires_at: expiresAt.toISOString(),
        verified: false
      });

    if (error) {
      console.error('Error sending OTP:', error);
      return { success: false, message: 'Failed to send OTP' };
    }

    console.log(`OTP for ${phoneNumber}: ${otp}`);

    return { success: true, message: `OTP sent to ${phoneNumber}. Check console for OTP code.` };
  } catch (error) {
    console.error('Error in sendOTP:', error);
    return { success: false, message: 'An error occurred while sending OTP' };
  }
};

export const verifyOTP = async (phoneNumber: string, otpCode: string): Promise<PhoneAuthResult> => {
  try {
    const { data: otpData, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone_number', phoneNumber)
      .eq('otp_code', otpCode)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpData) {
      return { success: false, message: 'Invalid or expired OTP' };
    }

    await supabase
      .from('otp_codes')
      .update({ verified: true })
      .eq('id', otpData.id);

    let userId: string;
    const { data: existingUser } = await supabase
      .from('phone_users')
      .select('id')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (existingUser) {
      userId = existingUser.id;
      await supabase
        .from('phone_users')
        .update({
          phone_verified: true,
          last_login_at: new Date().toISOString()
        })
        .eq('id', userId);
    } else {
      const { data: newUser, error: createError } = await supabase
        .from('phone_users')
        .insert({
          phone_number: phoneNumber,
          phone_verified: true,
          last_login_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError || !newUser) {
        return { success: false, message: 'Failed to create user' };
      }

      userId = newUser.id;
    }

    return {
      success: true,
      message: 'OTP verified successfully',
      userId
    };
  } catch (error) {
    console.error('Error in verifyOTP:', error);
    return { success: false, message: 'An error occurred while verifying OTP' };
  }
};

export const getUserProfile = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles_extended')
      .select('*')
      .eq('phone_user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return null;
  }
};

export const updateUserProfile = async (userId: string, profileData: any) => {
  try {
    const { data: existingProfile } = await supabase
      .from('user_profiles_extended')
      .select('id')
      .eq('phone_user_id', userId)
      .maybeSingle();

    if (existingProfile) {
      const { error } = await supabase
        .from('user_profiles_extended')
        .update({
          ...profileData,
          updated_at: new Date().toISOString()
        })
        .eq('phone_user_id', userId);

      if (error) {
        console.error('Error updating profile:', error);
        return { success: false, message: 'Failed to update profile' };
      }
    } else {
      const { error } = await supabase
        .from('user_profiles_extended')
        .insert({
          phone_user_id: userId,
          ...profileData
        });

      if (error) {
        console.error('Error creating profile:', error);
        return { success: false, message: 'Failed to create profile' };
      }
    }

    return { success: true, message: 'Profile updated successfully' };
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    return { success: false, message: 'An error occurred while updating profile' };
  }
};
