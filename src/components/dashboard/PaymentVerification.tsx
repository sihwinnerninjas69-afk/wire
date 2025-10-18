import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PendingOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  total_amount: number;
  created_at: string;
  screenshot_id: string;
  screenshot_url: string;
  items: any[];
}

export const PaymentVerification = () => {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    loadPendingOrders();
  }, []);

  const loadPendingOrders = async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_name,
          customer_phone,
          customer_email,
          total_amount,
          created_at,
          items
        `)
        .eq('status', 'pending_verification')
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error loading orders:', ordersError);
        toast.error('Failed to load orders');
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const ordersWithScreenshots = await Promise.all(
        ordersData.map(async (order) => {
          const { data: screenshotData } = await supabase
            .from('payment_screenshots')
            .select('id, screenshot_url')
            .eq('order_id', order.id)
            .eq('verification_status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...order,
            screenshot_id: screenshotData?.id || '',
            screenshot_url: screenshotData?.screenshot_url || '',
          };
        })
      );

      setOrders(ordersWithScreenshots.filter((order) => order.screenshot_url));
    } catch (error) {
      console.error('Error in loadPendingOrders:', error);
      toast.error('An error occurred while loading orders');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (orderId: string, screenshotId: string) => {
    setProcessing(orderId);

    try {
      const { error: screenshotError } = await supabase
        .from('payment_screenshots')
        .update({
          verification_status: 'approved',
          verified_at: new Date().toISOString(),
          verified_by: 'admin'
        })
        .eq('id', screenshotId);

      if (screenshotError) {
        console.error('Error updating screenshot:', screenshotError);
        toast.error('Failed to approve payment');
        return;
      }

      setOrders((prev) => prev.filter((order) => order.id !== orderId));
      toast.success('Payment approved successfully');
    } catch (error) {
      console.error('Error in handleApprove:', error);
      toast.error('An error occurred while approving payment');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (orderId: string, screenshotId: string) => {
    setProcessing(orderId);

    try {
      const { error: screenshotError } = await supabase
        .from('payment_screenshots')
        .update({
          verification_status: 'rejected',
          verified_at: new Date().toISOString(),
          verified_by: 'admin'
        })
        .eq('id', screenshotId);

      if (screenshotError) {
        console.error('Error updating screenshot:', screenshotError);
        toast.error('Failed to reject payment');
        return;
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          payment_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderError) {
        console.error('Error updating order:', orderError);
      }

      setOrders((prev) => prev.filter((order) => order.id !== orderId));
      toast.success('Payment rejected');
    } catch (error) {
      console.error('Error in handleReject:', error);
      toast.error('An error occurred while rejecting payment');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Payment Verification</CardTitle>
          <CardDescription>
            Review and approve payment screenshots from customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pending Verifications</h3>
              <p className="text-sm text-muted-foreground">
                All payments have been verified
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Screenshot</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="font-medium">{order.order_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {order.items?.length || 0} items
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.customer_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {order.customer_phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">₹{order.total_amount.toFixed(2)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(order.created_at), 'PPp')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedImage(order.screenshot_url)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleReject(order.id, order.screenshot_id)}
                          disabled={processing === order.id}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(order.id, order.screenshot_id)}
                          disabled={processing === order.id}
                        >
                          {processing === order.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payment Screenshot</DialogTitle>
            <DialogDescription>
              Review the payment screenshot submitted by the customer
            </DialogDescription>
          </DialogHeader>
          {selectedImage && (
            <div className="mt-4">
              <img
                src={selectedImage}
                alt="Payment Screenshot"
                className="w-full rounded-lg border"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
