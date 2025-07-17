const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY, // From Razorpay Dashboard
  key_secret: process.env.RAZORPAY_SECRET,
});

// Create Razorpay order

const post_createOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        console.log(amount);
        
        const options = {
        amount: amount * 100, // Amount in paise
        currency: 'INR',
        receipt: `receipt_order_${Date.now()}`,
        };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating Razorpay order');
    }
}

const post_verifyPayment = async (req, res) => {
    const crypto = require('crypto');
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const expectedSignature = crypto.createHmac('sha256', 'YOUR_KEY_SECRET')
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (expectedSignature === razorpay_signature) {
        return res.status(200).json({ success: true, message: 'Payment verified successfully' });
    } else {
        return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
}


module.exports = {
    post_createOrder,
    post_verifyPayment
}