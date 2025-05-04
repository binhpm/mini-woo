"use client"
import {useCallback, useEffect} from "react";
import {useTelegram} from "@/providers/telegram-provider";
import {useAppContext} from "@/providers/context-provider";
import StoreFront from "@/components/store-front";
import OrderOverview from "@/components/order-overview";
import ProductOverview from "@/components/product-overview";

type OrderItem = {
    id: number;
    count: number;
}

type PaymentStatus = 'paid' | 'failed' | 'unknown';

export default function Home() {
    const {webApp, user} = useTelegram()
    const {state, dispatch} = useAppContext()

    const validateShippingInfo = () => {
        if (!state.shippingInfo?.name) {
            webApp?.showAlert("Please enter your full name")
            return false
        }
        if (!state.shippingInfo?.phone) {
            webApp?.showAlert("Please enter your phone number")
            return false
        }
        if (!state.shippingInfo?.address?.street_line1) {
            webApp?.showAlert("Please enter your street address")
            return false
        }
        if (!state.shippingInfo?.address?.city) {
            webApp?.showAlert("Please enter your city")
            return false
        }
        if (!state.shippingInfo?.address?.post_code) {
            webApp?.showAlert("Please enter your postal code")
            return false
        }
        if (!state.shippingInfo?.address?.country_code) {
            webApp?.showAlert("Please enter your country code")
            return false
        }
        return true
    }

    const handleCheckout = useCallback(async () => {
        webApp?.MainButton.showProgress()
        
        if (state.paymentMethod === 'cod' && !validateShippingInfo()) {
            webApp?.MainButton.hideProgress()
            return
        }

        const items: OrderItem[] = Array.from(state.cart.values()).map((item) => ({
            id: item.product.id,
            count: item.count
        }))
        
        const body = JSON.stringify({
            userId: user?.id,
            username: user?.username,  // Add username
            chatId: webApp?.initDataUnsafe.chat?.id,
            comment: state.comment,
            shippingZone: state.shippingZone,
            paymentMethod: state.paymentMethod,
            items,
            shippingInfo: state.paymentMethod === 'cod' ? state.shippingInfo : undefined
        })

        try {
            const res = await fetch("api/orders", {method: "POST", body})
            const result = await res.json()

            if (result.payment_method === 'cod') {
                webApp?.MainButton.hideProgress()
                const message = `Order #${result.order_id} has been placed successfully!\n\n` +
                              `Delivery Address:\n` +
                              `${state.shippingInfo?.name}\n` +
                              `${state.shippingInfo?.address.street_line1}\n` +
                              `${state.shippingInfo?.address.street_line2 ? state.shippingInfo?.address.street_line2 + '\n' : ''}` +
                              `${state.shippingInfo?.address.city}, ${state.shippingInfo?.address.state || ''}\n` +
                              `${state.shippingInfo?.address.country_code} ${state.shippingInfo?.address.post_code}\n\n` +
                              `Contact:\n` +
                              `${user?.username ? '@' + user.username + '\n' : ''}` +  // Add username to message
                              `Phone: ${state.shippingInfo?.phone}\n` +
                              `${state.shippingInfo?.email ? 'Email: ' + state.shippingInfo.email + '\n' : ''}` +
                              `\nPayment Method: Cash on Delivery\n` +
                              `${state.comment ? '\nOrder Notes:\n' + state.comment : ''}`
                
                webApp?.showPopup({
                    title: 'Order Confirmed!',
                    message: message,
                    buttons: [{
                        type: 'ok',
                        text: 'Close'
                    }]
                }, () => webApp?.close())
                return
            }

            // Handle Telegram payment
            const invoiceSupported = webApp?.isVersionAtLeast('6.1')
            if (!invoiceSupported) {
                webApp?.showAlert("Telegram payment requires app version 6.1 or higher. Please update your Telegram app!")
                webApp?.MainButton.hideProgress()
                return
            }

            webApp?.openInvoice(result.invoice_link, (status) => {
                webApp?.MainButton.hideProgress()
                if (status === 'paid') {
                    console.log("[paid] InvoiceStatus " + result.order_id)
                    webApp?.showPopup({
                        title: 'Payment Successful!',
                        message: `Order #${result.order_id} has been confirmed.\nThank you for your purchase!`,
                        buttons: [{
                            type: 'ok',
                            text: 'Close'
                        }]
                    }, () => webApp?.close())
                } else if (status === 'failed') {
                    console.log("[failed] InvoiceStatus " + result.order_id)
                    webApp?.HapticFeedback.notificationOccurred('error')
                    webApp?.showPopup({
                        title: 'Payment Failed',
                        message: 'Your payment could not be processed. Please try again.',
                        buttons: [{
                            type: 'ok',
                            text: 'OK'
                        }]
                    })
                } else if (status === 'cancelled') {
                    console.log("[cancelled] InvoiceStatus " + result.order_id)
                    webApp?.HapticFeedback.notificationOccurred('warning')
                } else if (status === 'pending') {
                    console.log("[pending] InvoiceStatus " + result.order_id)
                    webApp?.HapticFeedback.notificationOccurred('warning')
                }
            })
        } catch (error) {
            console.error('Checkout error:', error)
            webApp?.showAlert("An error occurred while processing your order!")
            webApp?.MainButton.hideProgress()
        }
    }, [webApp, user, state.cart, state.comment, state.shippingZone, state.paymentMethod, state.shippingInfo])

    useEffect(() => {
        const callback = state.mode === "order" ? handleCheckout :
            () => dispatch({type: "order"})
        webApp?.MainButton.setParams({
            text_color: '#fff',
            color: '#31b545'
        }).onClick(callback)
        webApp?.BackButton.onClick(() => dispatch({type: "storefront"}))
        return () => {
            //prevent multiple call
            webApp?.MainButton.offClick(callback)
        }
    }, [webApp, state.mode, handleCheckout])

    useEffect(() => {
        if (state.mode === "storefront")
            webApp?.BackButton.hide()
        else
            webApp?.BackButton.show()

        if (state.mode === "order")
            webApp?.MainButton.setText("CHECKOUT")
        else
            webApp?.MainButton.setText("VIEW ORDER")
    }, [state.mode])

    useEffect(() => {
        if (state.cart.size !== 0) {
            webApp?.MainButton.show()
            webApp?.enableClosingConfirmation()
        } else {
            webApp?.MainButton.hide()
            webApp?.disableClosingConfirmation()
        }
    }, [state.cart.size])

    return (
        <main className={`${state.mode}-mode`}>
            <StoreFront/>
            <ProductOverview/>
            <OrderOverview/>
        </main>
    )
}
