import {Markup, Telegraf} from "telegraf";
import {message} from "telegraf/filters"
import {LabeledPrice} from "@telegraf/types";
import woo from "@/lib/woo";

export const SECRET_HASH = process.env.TELEGRAM_BOT_SECRET!!
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || `https://${process.env.NEXT_PUBLIC_VERCEL_URL!!}`
const WEBHOOK_URL = `${BASE_PATH}/api/telegram-hook?secret_hash=${SECRET_HASH}`
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!!
const bot = new Telegraf(BOT_TOKEN)

bot.start((ctx) => {
    ctx.reply(
        "Let's get started ;)",
        Markup.inlineKeyboard([Markup.button.webApp("View Menu", BASE_PATH)]),
    )
});
bot.help((ctx) => ctx.reply("Test /start or /menu command!"))
bot.command('menu', (ctx) =>
    ctx.setChatMenuButton({
        text: "Store",
        type: "web_app",
        web_app: {url: BASE_PATH},
    }))
bot.on(message("text"), (ctx) => ctx.reply("Hi, I`m NetViet Restaurant bot. It`s nice to meet you!:) /help"));

bot.on("shipping_query", async (ctx) => {
    const payload = JSON.parse(ctx.update.shipping_query.invoice_payload)
    const shippingOptions = await woo.getShippingOptions(payload.shippingZone)
    if (shippingOptions.length)
        ctx.answerShippingQuery(true, shippingOptions, undefined)
    else
        ctx.answerShippingQuery(false, undefined, "No shipping option available at your zone!")
});

bot.on("pre_checkout_query", async (ctx) => {
    const payload = JSON.parse(ctx.update.pre_checkout_query.invoice_payload)
    const orderInfo = ctx.update.pre_checkout_query.order_info!!
    
    // Convert Telegram's OrderInfo to our ShippingInfo type with proper validation
    const shippingInfo = {
        name: orderInfo.name || '',
        email: orderInfo.email || '',
        phone: orderInfo.phone_number || '',
        address: {
            street_line1: orderInfo.shipping_address?.street_line1 || '',
            street_line2: orderInfo.shipping_address?.street_line2 || '',
            city: orderInfo.shipping_address?.city || '',
            state: orderInfo.shipping_address?.state || '',
            country_code: orderInfo.shipping_address?.country_code || '',
            post_code: orderInfo.shipping_address?.post_code || ''
        }
    };

    // Validate required shipping fields
    if (!shippingInfo.name || 
        !shippingInfo.phone || 
        !shippingInfo.address.street_line1 || 
        !shippingInfo.address.city || 
        !shippingInfo.address.country_code || 
        !shippingInfo.address.post_code) {
        await ctx.answerPreCheckoutQuery(false, "Please provide complete shipping information!");
        return;
    }

    const res = await woo.updateOrderInfo(payload.orderId, shippingInfo)
    if (res.status === 200)
        await ctx.answerPreCheckoutQuery(true);
    else
        await ctx.answerPreCheckoutQuery(false, "Problem occurred during order update. Please try again or contact support.");
});

bot.on(message("successful_payment"), async (ctx) => {
    const payload = JSON.parse(ctx.update.message.successful_payment.invoice_payload)
    const res = await woo.setOrderPaid(payload.orderId)
    if (res.status === 200) {
        ctx.reply("Order successfully registered!")
    } else
        ctx.reply(`Error registering payment, contact support!\n
        orderId:${payload.orderId}\n
        ${ctx.update.message.successful_payment.telegram_payment_charge_id}\n
        ${ctx.update.message.successful_payment.provider_payment_charge_id}
        `)
});

export function initWebhook() {
    return bot.telegram.setWebhook(WEBHOOK_URL)
}

export async function createInvoiceLink(
    orderId: number,
    orderKey: string,
    currency: string,
    prices: LabeledPrice[],
    shippingZone: number
) {
    const telegramInvoice = {
        provider_token: process.env.TELEGRAM_PAYMENT_PROVIDER_TOKEN!!,
        title: `Order Invoice ${orderId}`,
        description: `Payment invoice for ${orderKey}`,
        currency,
        photo_url: undefined, //TODO: env
        is_flexible: false, //TODO: env
        prices,
        payload: JSON.stringify({orderId, shippingZone}),
        need_name: true,
        need_email: true,
        need_phone_number: true,
        need_shipping_address: true
    };

    //https://core.telegram.org/bots/api#createinvoicelink
    return await bot.telegram.createInvoiceLink(telegramInvoice);
}

export default bot
