import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { createPaymentIntent, getStripe } from '@/lib/stripe-payment';

interface StripePaymentFormProps {
  amount: number;
  orderId: string;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
}

export const StripePaymentForm = ({
  amount,
  orderId,
  customerEmail,
  customerName,
  customerPhone,
  onSuccess,
  onCancel,
}: StripePaymentFormProps) => {
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState(customerName);
  const { toast } = useToast();

  const handlePayment = async () => {
    if (!cardNumber || !expiryDate || !cvv || !cardholderName) {
      toast({
        title: 'Invalid Card Details',
        description: 'Please fill in all card details',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const result = await createPaymentIntent({
        amount,
        currency: 'INR',
        orderId,
        customerEmail,
        customerName,
        customerPhone,
      });

      if (!result.success || !result.clientSecret) {
        throw new Error(result.error || 'Failed to create payment');
      }

      const stripe = await getStripe();
      if (!stripe) {
        throw new Error('Stripe is not configured');
      }

      toast({
        title: 'Payment Successful',
        description: 'Your payment has been processed successfully',
      });

      onSuccess(result.paymentIntentId!);
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'Payment Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.slice(0, 19);
  };

  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Payment Details</CardTitle>
        <CardDescription>Enter your card information to complete the payment</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Amount:</span>
              <span className="text-2xl font-bold">₹{amount.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardholderName">Cardholder Name</Label>
            <Input
              id="cardholderName"
              type="text"
              placeholder="John Doe"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              type="text"
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              maxLength={19}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                type="text"
                placeholder="MM/YY"
                value={expiryDate}
                onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                maxLength={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                type="text"
                placeholder="123"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                maxLength={3}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={onCancel} variant="outline" className="flex-1" disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handlePayment} className="flex-1" disabled={loading}>
              {loading ? 'Processing...' : `Pay ₹${amount.toFixed(2)}`}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Your payment is secure and encrypted
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
