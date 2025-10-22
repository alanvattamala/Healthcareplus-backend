import express from 'express';
import { createOrder, verifyPayment, getPaymentDetails } from '../controllers/paymentController.js';

const router = express.Router();

// Route to create Razorpay order
router.post('/create-order', createOrder);

// Route to verify payment and complete appointment booking
router.post('/verify-payment', verifyPayment);

// Route to get payment details
router.get('/payment/:paymentId', getPaymentDetails);

export default router;
