import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, CreditCard, MapPin, Package } from 'lucide-react';
import { getCartItems, getCartTotal, clearCart } from '@/lib/cart-storage';
import { saveOrder, generateOrderNumber, calculateEstimatedDelivery, calculateShippingCost, updateOrderStatus, type Order } from '@/lib/order-storage';
import { toast } from 'sonner';
import { useUserAuth } from '@/context/UserAuthContext';
import { StripePaymentForm } from '@/components/checkout/StripePaymentForm';

const Checkout = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useUserAuth();
  const cartItems = getCartItems();
  const subtotal = getCartTotal();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentOrderNumber, setCurrentOrderNumber] = useState<string>('');
  const [currentQrData, setCurrentQrData] = useState<string>('');

  useEffect(() => {
    if (cartItems.length === 0) {
      navigate('/cart');
    }
  }, [cartItems, navigate]);

  useEffect(() => {
    if (!user) return;
    const phoneNumber = user.phoneNumber?.trim();
    if (!phoneNumber) return;
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
    if (!phone) setPhone(cleanPhone);
  }, [user]);

  const shippingCost = pincode ? calculateShippingCost(pincode, subtotal) : 0;
  const total = subtotal + shippingCost;

  const validateForm = () => {
    if (!name.trim()) {
      toast.error('Please enter your name');
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email');
      return false;
    }
    if (!phone.trim() || phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return false;
    }
    if (!address.trim()) {
      toast.error('Please enter your address');
      return false;
    }
    if (!pincode.trim() || pincode.length !== 6) {
      toast.error('Please enter a valid 6-digit pincode');
      return false;
    }
    return true;
  };

  const handleProceedToPayment = () => {
    if (!validateForm()) return;
    const newOrderNumber = generateOrderNumber();
    setCurrentOrderNumber(newOrderNumber);
    setShowPayment(true);
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    if (!isAuthenticated || !user) {
      toast.error('Please log in to place an order');
      return;
    }

    setIsProcessing(true);

    const order: Order = {
      id: `order_${Date.now()}`,
      orderNumber: currentOrderNumber || generateOrderNumber(),
      userId: user.id,
      customerInfo: {
        name,
        email,
        phone,
        address,
        pincode
      },
      items: cartItems,
      subtotal,
      shippingCost,
      totalAmount: total,
      status: 'pending',
      paymentStatus: 'completed',
      paymentMethod: 'stripe',
      transactionId: paymentIntentId,
      createdAt: new Date().toISOString(),
      estimatedDelivery: calculateEstimatedDelivery(pincode)
    };

    try {
      await saveOrder(order);

      try {
        await updateOrderStatus(order.id, order.status, 'completed', user.id);
      } catch (e) {
        console.warn('Payment confirmation update failed', e);
      }

      clearCart();
      navigate(`/order-confirmation/${order.id}`);
    } catch (error) {
      console.error('Error placing order:', error);
      toast.error('Failed to place order. Please try again.');
      setIsProcessing(false);
    }
  };

  if (showPayment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Button
            variant="ghost"
            onClick={() => setShowPayment(false)}
            className="mb-6"
            disabled={isProcessing}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Details
          </Button>

          <StripePaymentForm
            amount={total}
            orderId={currentOrderNumber}
            customerEmail={email}
            customerName={name}
            customerPhone={phone}
            onSuccess={handlePaymentSuccess}
            onCancel={() => setShowPayment(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate('/cart')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Cart
        </Button>

        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  <CardTitle>Shipping Information</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit number"
                      maxLength={10}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Complete Address *</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="House No, Street, Area, City, State"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="6-digit pincode"
                    maxLength={6}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  <CardTitle>Order Summary</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items ({cartItems.length})</span>
                    <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium">
                      {pincode ? (shippingCost === 0 ? 'FREE' : `₹${shippingCost.toFixed(2)}`) : 'TBD'}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-primary to-secondary"
                  onClick={handleProceedToPayment}
                >
                  Proceed to Payment
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Secure payment via Stripe
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
