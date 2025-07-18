const { default: axios } = require('axios');
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

const post_createContact = async (req, res) => {
    try {
        const { name, email, contact } = req.body;
        const response = await axios.post('https://api.razorpay.com/v1/contacts', {
            name,
            email,
            contact,
            type: 'vendor',
        }, { auth });

        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

const post_createFundAccount = async (req, res) => {
  try {
    const { name, contact, email, upi_id } = req.body;

    // Razorpay basic auth
    const auth = {
      username: process.env.RAZORPAY_KEY,
      password: process.env.RAZORPAY_SECRET,
    };

    // 1. Create Contact
    const contactResp = await axios.post(
      'https://api.razorpay.com/v1/contacts',
      {
        name,
        contact,
        email,
        type: 'vendor',
      },
      { auth }
    );

    const contact_id = contactResp.data.id;

    // 2. Create Fund Account
    const fundResp = await axios.post(
      'https://api.razorpay.com/v1/fund_accounts',
      {
        contact_id,
        account_type: 'vpa',
        vpa: { address: upi_id },
      },
      { auth }
    );

    const fundAccountId = fundResp.data.id;

    res.json({ fundAccountId });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
};

const post_payoutToShopkeeper = async (req, res) => {
  try {
    const { fund_account_id, amount } = req.body;

    const auth = {
      username: process.env.RAZORPAY_KEY,
      password: process.env.RAZORPAY_SECRET,
    };

    const response = await axios.post(
      'https://api.razorpay.com/v1/payouts',
      {
        account_number: process.env.ACCOUNT_NUMBER,
        fund_account_id,
        amount: amount * 100,
        currency: 'INR',
        mode: 'UPI',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: `shop_payout_${Date.now()}`,
        narration: 'Shopkeeper payout',
      },
      {
        auth,
      }
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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
    post_createContact,
    post_createFundAccount,
    post_payoutToShopkeeper,
    post_verifyPayment,
}