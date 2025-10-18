import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, MapPin, Package, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import { getCartItems, getCartTotal, clearCart } from '@/lib/cart-storage';
import { generateOrderNumber, calculateEstimatedDelivery, calculateShippingCost } from '@/lib/order-storage';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Checkout = () => {
  const navigate = useNavigate();
  const cartItems = getCartItems();
  const subtotal = getCartTotal();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loadingQr, setLoadingQr] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    if (cartItems.length === 0) {
      navigate('/cart');
    }
  }, [cartItems, navigate]);

  useEffect(() => {
    if (showPayment) {
      loadQrCode();
    }
  }, [showPayment]);

  const loadQrCode = async () => {
    setLoadingQr(true);
    try {
      const { data, error } = await supabase
        .from('payment_qr_codes')
        .select('image_url')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading QR code:', error);
        toast.error('Failed to load payment QR code');
        return;
      }

      if (data) {
        setQrCodeUrl(data.image_url);
      } else {
        toast.error('No payment QR code available. Please contact support.');
      }
    } catch (error) {
      console.error('Error in loadQrCode:', error);
      toast.error('An error occurred while loading payment QR code');
    } finally {
      setLoadingQr(false);
    }
  };

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
    setShowPayment(true);
  };

  const handleScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setScreenshot(file);
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCompletePayment = async () => {
    if (!screenshot) {
      toast.error('Please upload payment screenshot');
      return;
    }

    setUploading(true);

    try {
      const orderNumber = generateOrderNumber();
      const userId = `guest_${Date.now()}`;

      const fileExt = screenshot.name.split('.').pop();
      const fileName = `payment-${orderNumber}-${Date.now()}.${fileExt}`;
      const filePath = `payment-screenshots/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-images')
        .upload(filePath, screenshot);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload screenshot');
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('payment-images')
        .getPublicUrl(filePath);

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          order_number: orderNumber,
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          customer_address: address,
          customer_pincode: pincode,
          items: cartItems,
          subtotal: subtotal,
          shipping_cost: shippingCost,
          total_amount: total,
          status: 'pending_verification',
          payment_status: 'pending',
          payment_method: 'qr_code',
          estimated_delivery: calculateEstimatedDelivery(pincode)
        })
        .select()
        .single();

      if (orderError) {
        console.error('Order error:', orderError);
        toast.error('Failed to create order');
        setUploading(false);
        return;
      }

      const { error: screenshotError } = await supabase
        .from('payment_screenshots')
        .insert({
          order_id: orderData.id,
          user_id: userId,
          screenshot_url: urlData.publicUrl,
          verification_status: 'pending'
        });

      if (screenshotError) {
        console.error('Screenshot error:', screenshotError);
      }

      clearCart();
      setShowConfirmDialog(true);
    } catch (error) {
      console.error('Error in handleCompletePayment:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (showPayment) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-background via-accent/10 to-background">
          <div className="container mx-auto px-4 py-8 max-w-2xl">
            <Button
              variant="ghost"
              onClick={() => setShowPayment(false)}
              className="mb-6"
              disabled={uploading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Details
            </Button>

            <Card>
              <CardHeader>
                <CardTitle>Complete Payment</CardTitle>
                <CardDescription>
                  Scan the QR code below and upload payment screenshot
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingQr ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : qrCodeUrl ? (
                  <div className="space-y-4">
                    <div className="border rounded-lg p-6 bg-muted/30">
                      <img
                        src={qrCodeUrl}
                        alt="Payment QR Code"
                        className="max-w-sm mx-auto"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Upload Payment Screenshot *</Label>
                      <div className="border-2 border-dashed rounded-lg p-6">
                        {screenshotPreview ? (
                          <div className="space-y-4">
                            <img
                              src={screenshotPreview}
                              alt="Screenshot Preview"
                              className="max-w-xs mx-auto rounded-lg"
                            />
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => {
                                setScreenshot(null);
                                setScreenshotPreview('');
                              }}
                            >
                              Change Screenshot
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center space-y-4">
                            <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                            <div>
                              <Label htmlFor="screenshot-upload" className="cursor-pointer">
                                <div className="text-sm text-muted-foreground">
                                  Click to select payment screenshot
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  PNG, JPG or JPEG (max 10MB)
                                </div>
                              </Label>
                              <Input
                                id="screenshot-upload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleScreenshotSelect}
                              />
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => document.getElementById('screenshot-upload')?.click()}
                            >
                              Select File
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subtotal</span>
                        <span>₹{subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Shipping</span>
                        <span>{shippingCost === 0 ? 'FREE' : `₹${shippingCost.toFixed(2)}`}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold">
                        <span>Total</span>
                        <span>₹{total.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleCompletePayment}
                      disabled={!screenshot || uploading}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          I Have Completed the Payment
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      Payment QR code is not available. Please contact support.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Order Submitted
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                Your order will be placed after the owner verifies the payment.
                You will receive a confirmation once verified.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Button onClick={() => navigate('/')} className="w-full">
              Back to Home
            </Button>
          </AlertDialogContent>
        </AlertDialog>
      </>
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
                  Secure payment via QR code
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
