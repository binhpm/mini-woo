import {NextRequest, NextResponse} from "next/server";
import { createInvoiceLink } from "@/lib/bot";
import woo from "@/lib/woo";
import telegramCurrencies from "@/lib/telegram-currencies";

interface OrderItem {
    id: number;
    count: number;
}

interface OrderRequestBody {
    items: OrderItem[];
    paymentMethod: 'cod' | 'telegram';
    comment?: string;
    shippingZone: number;
    shippingInfo?: {
        name: string;
        email?: string;
        phone?: string;
        address: {
            street_line1: string;
            street_line2?: string;
            city: string;
            state?: string;
            country_code: string;
            post_code: string;
        };
    };
}

interface OrderResponse {
    order_id: number;
    status: 'pending';
    payment_method: 'cod' | 'telegram';
    invoice_link?: string;
}

export async function POST(request: NextRequest) {
    const body = await request.json() as OrderRequestBody;
    const paymentMethod = body.paymentMethod || 'cod';

    const line_items = body.items.map((item) => ({
        product_id: item.id,
        quantity: item.count
    }));

    // Create order first
    const order = await woo.createOrder(line_items, body.comment || '', paymentMethod);

    // Update shipping information for COD orders
    if (paymentMethod === 'cod' && body.shippingInfo) {
        // Validate required shipping fields
        if (!body.shippingInfo.name || 
            !body.shippingInfo.phone || 
            !body.shippingInfo.address.street_line1 || 
            !body.shippingInfo.address.city || 
            !body.shippingInfo.address.country_code || 
            !body.shippingInfo.address.post_code) {
            return NextResponse.json({ error: 'Missing required shipping information' }, { status: 400 });
        }

        const shippingUpdateRes = await woo.updateOrderInfo(order.id, body.shippingInfo);
        if (shippingUpdateRes.status !== 200) {
            return NextResponse.json({ error: 'Failed to update shipping information' }, { status: 500 });
        }
    }

    const response: OrderResponse = {
        order_id: order.id,
        status: 'pending',
        payment_method: paymentMethod as 'cod' | 'telegram'
    };

    if (paymentMethod === 'cod') {
        return NextResponse.json(response);
    }

    // Handle Telegram payment
    const telegramCurrency = telegramCurrencies[order.currency as keyof typeof telegramCurrencies];
    if (!telegramCurrency) {
        throw new Error(`Unsupported currency: ${order.currency}`);
    }

    const prices = order.line_items.map((item) => ({
        label: `${item.name} (x${item.quantity})`,
        amount: parseFloat(item.total) * Math.pow(10, telegramCurrency.exp)
    }));

    response.invoice_link = await createInvoiceLink(
        order.id, 
        order.order_key,
        telegramCurrency.code, 
        prices, 
        body.shippingZone
    );

    return NextResponse.json(response);
}
