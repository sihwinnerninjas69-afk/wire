import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { sendOTP, verifyOTP } from '@/lib/phone-auth';

interface PhoneOTPLoginProps {
  onSuccess: (userId: string, phoneNumber: string) => void;
}

export const PhoneOTPLogin = ({ onSuccess }: PhoneOTPLoginProps) => {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Please enter a valid 10-digit phone number',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
    const result = await sendOTP(formattedPhone);
    setLoading(false);

    if (result.success) {
      toast({
        title: 'OTP Sent',
        description: result.message,
      });
      setStep('otp');
    } else {
      toast({
        title: 'Error',
        description: result.message,
        variant: 'destructive',
      });
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast({
        title: 'Invalid OTP',
        description: 'Please enter a valid 6-digit OTP',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
    const result = await verifyOTP(formattedPhone, otpCode);
    setLoading(false);

    if (result.success && result.userId) {
      toast({
        title: 'Login Successful',
        description: 'You have been logged in successfully',
      });
      onSuccess(result.userId, formattedPhone);
    } else {
      toast({
        title: 'Verification Failed',
        description: result.message,
        variant: 'destructive',
      });
    }
  };

  const handleResendOTP = async () => {
    setOtpCode('');
    const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`;
    const result = await sendOTP(formattedPhone);

    if (result.success) {
      toast({
        title: 'OTP Resent',
        description: result.message,
      });
    } else {
      toast({
        title: 'Error',
        description: result.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Phone Login</CardTitle>
        <CardDescription>
          {step === 'phone'
            ? 'Enter your phone number to receive an OTP'
            : 'Enter the OTP sent to your phone'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'phone' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 border rounded-md bg-muted">+91</span>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                />
              </div>
            </div>
            <Button
              onClick={handleSendOTP}
              disabled={loading || phoneNumber.length < 10}
              className="w-full"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Enter OTP</Label>
              <Input
                id="otp"
                type="text"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
              />
            </div>
            <div className="space-y-2">
              <Button
                onClick={handleVerifyOTP}
                disabled={loading || otpCode.length !== 6}
                className="w-full"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </Button>
              <div className="flex justify-between items-center text-sm">
                <Button
                  variant="link"
                  onClick={() => setStep('phone')}
                  className="p-0 h-auto"
                >
                  Change Number
                </Button>
                <Button
                  variant="link"
                  onClick={handleResendOTP}
                  className="p-0 h-auto"
                >
                  Resend OTP
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
