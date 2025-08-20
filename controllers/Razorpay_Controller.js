const { default: axios } = require('axios');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY, // From Razorpay Dashboard
  key_secret: process.env.RAZORPAY_SECRET,
});

const auth = {
  username: process.env.RAZORPAY_KEY,
  password: process.env.RAZORPAY_SECRET,
};

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
        const { name, email, contact, type } = req.body;
        const response = await axios.post('https://api.razorpay.com/v1/contacts', {
            name,
            email,
            contact,
            type,
        }, { auth });

        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

const post_createFundAccount = async (req, res) => {
  try {
    const { name, contact, email, upi_id, type } = req.body;

    // Basic local format check for UPI ID before API call (optional)
    // const upiRegex = /^[\w.\-]{2,50}@[a-z]{3,}$/i;
    // if (!upiRegex.test(upi_id)) {
    //   return res.status(400).json({ error: "Invalid UPI format" });
    // }

    // Create contact
    const contactResp = await axios.post(
      "https://api.razorpay.com/v1/contacts",
      { name, contact, email, type },
      { auth }
    );

    // Create fund account with VPA (this will validate on Razorpay side)
    const fundResp = await axios.post(
      "https://api.razorpay.com/v1/fund_accounts",
      {
        contact_id: contactResp.data.id,
        account_type: "vpa",
        vpa: { address: upi_id }
      },
      { auth }
    );

    res.json({
      message: "Fund account created successfully",
      fund_account_id: fundResp.data.id,
      contact_id: contactResp.data.id
    });

  } catch (err) {
    // If Razorpay returns an error about invalid UPI, catch it here
    const errData = err.response?.data;
    if (
      errData &&
      errData.error &&
      errData.error.description.includes("invalid")
    ) {
      return res.status(400).json({ error: "Invalid UPI ID" });
    }
    console.error(errData || err.message);
    res.status(500).json({error : errData.error.description} || { error: err.message });
  }
};



const post_payoutToShopkeeper = async (req, res) => {
  try {
    const { fund_account_id, amount } = req.body;
    console.log(fund_account_id, amount, process.env.ACCOUNT_NUMBER);
    

    const response = await axios.post(
      'https://api.razorpay.com/v1/payouts',
      {
        account_number: '2323230011990505',
        fund_account_id,
        amount: amount,
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
    console.log(err);
    
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


const get_paymentDetails = async (req, res) => {
  try {
    const { payment_id } = req.params; // pass payment_id in URL

    const response = await axios.get(
      `https://api.razorpay.com/v1/payments/${payment_id}`,
      { auth }
    );

    // Extract important fields
    const payment = response.data;
    const result = {
      payment_id: payment.id,
      amount: payment.amount / 100, // in INR
      currency: payment.currency,
      status: payment.status,
      fee: (payment.fee || 0) / 100, // fee deducted
      tax: (payment.tax || 0) / 100, // GST on fee
      method: payment.method,
      order_id: payment.order_id,
      invoice_id: payment.invoice_id,
      international: payment.international,
      amount_refunded: payment.amount_refunded,
      refund_status: payment.refund_status,
      captured: payment.captured,
      description: payment.description,
      card_id: payment.card_id,
      bank: payment.bank,
      wallet: payment.wallet,
      vpa: payment.vpa,
      email: payment.email,
      contact: payment.contact,
      notes: payment.notes,
      error_code: payment.error_code,
      error_description: payment.error_description,
      captured_at: payment.captured_at,
      created_at: payment.created_at,
    };

    res.json(result);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.description || err.message,
    });
  }
};

const get_payoutDetails = async (req, res) => {
  try {
    const { payout_id } = req.params; // pass payment_id in URL

    const response = await axios.get(
      `https://api.razorpay.com/v1/payouts/${payout_id}`,
      { auth }
    );

    // Extract important fields
    const payout = response.data;

    res.json(payout);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.error?.description || err.message,
    });
  }
};



module.exports = {
    post_createOrder,
    post_createContact,
    post_createFundAccount,
    post_payoutToShopkeeper,
    post_verifyPayment,
    get_paymentDetails, 
    get_payoutDetails
}