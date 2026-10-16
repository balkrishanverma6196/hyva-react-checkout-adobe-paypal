# Adobe Payment Services PayPal Smart Buttons for Hyvä React Checkout

A payment method renderer that lets the [Hyvä React Checkout](https://github.com/hyva-themes/magento2-react-checkout)
take payments with the **PayPal Smart Buttons** of
[Payment Services for Adobe Commerce and Magento Open Source](https://experienceleague.adobe.com/docs/commerce-merchant-services/payment-services/guide-overview.html)
(`payment_services_paypal_smart_buttons`).

Out of the box the React Checkout has no renderers for Payment Services: the methods are listed, but there
is no PayPal button, and "Place Order" fails with *"Order is missing and can not be captured"*.

## Features

- Renders PayPal's own buttons (PayPal, Pay Later, Venmo, as PayPal decides the shopper is eligible), with
  the button styles configured in Payment Services.
- Loads the PayPal JS SDK from the parameters Payment Services provides (client id, intent, CSP nonce).
- Checks email, addresses and shipping method are complete before opening the PayPal window.
- On approval: sets the payment on the cart and places the order, then redirects to the success page.
- Clicking the checkout's own "Place Order" while PayPal is selected asks the customer to use the PayPal button.

## Requirements

- Hyvä React Checkout `hyva-themes/magento2-react-checkout` 1.1.x
- `magento/module-payment-services-paypal` (tested with 2.16.x), onboarded, with
  *Display buttons on checkout* enabled for PayPal Smart Buttons.

## Installation

1. Add the repository to `reactapp/package.json` of the React Checkout (the key must be a valid JS
   identifier, e.g. `paymentServicesPaypal`):

   ```json
   "config": {
     "paymentMethodsRepo": {
       "paymentServicesPaypal": "https://github.com/balkrishanverma6196/hyva-react-checkout-adobe-paypal.git"
     }
   }
   ```

2. `npm install && npm run build` in `reactapp/` (or copy this repository to
   `src/paymentMethods/paymentServicesPaypal/` and add `./paymentServicesPaypal/renderers` to
   `src/paymentMethods/customRenderers.js`), then deploy static content.

## Hide the Payment Services methods you can't run

This repository only covers PayPal Smart Buttons. The React Checkout also lists Payment Services' other
methods (card hosted fields, Apple Pay, Google Pay, Fastlane, local payment methods, vault) and ignores their
"display on checkout" settings; without renderers they can only fail at "Place Order". Hide them with a
GraphQL plugin on `Magento\QuoteGraphQl\Model\Resolver\AvailablePaymentMethods` in a module of your own
(`etc/graphql/di.xml`):

```php
public function afterResolve(AvailablePaymentMethods $subject, $result): array
{
    return array_values(array_filter((array) $result, function (array $method): bool {
        $code = (string) ($method['code'] ?? '');
        if (!str_starts_with($code, 'payment_services_paypal_')) {
            return true;
        }
        return $code === 'payment_services_paypal_smart_buttons'
            && $this->paymentServicesConfig->isLocationEnabled('checkout'); // Magento\PaymentServicesPaypal\Model\Config
    }));
}
```

## Replace "Place Order" while PayPal is selected

The PayPal button places the order itself, so the checkout's own "Place Order" button is redundant while
PayPal is selected (clicking it only shows *"Please use the PayPal button to complete your payment."*).
For a cleaner checkout, make `src/components/placeOrder/components/PlaceOrder.jsx` render a hint instead:

```jsx
const paymentCode = _get(values, `${PAYMENT_METHOD_FORM}.code`);

if (paymentCode === 'payment_services_paypal_smart_buttons') {
  return (
    <p className="py-4 text-center text-sm text-gray-700">
      {__('Use the PayPal button in Payment Methods to complete your order.')}
    </p>
  );
}
```

## How it works

1. `getPaymentConfig(location: CHECKOUT) { smart_buttons { is_visible sdk_params button_styles } }`
2. Button click: `createPaymentOrder(input: { cartId, methodCode: "payment_services_paypal_smart_buttons", paymentSource, location: CHECKOUT })`
   returns the PayPal order id (given to the PayPal SDK) and the Payment Services order id.
3. Approval: `setPaymentMethodOnCart(payment_method: { code, payment_services_paypal_smart_buttons: { payment_source, payments_order_id, paypal_order_id } })`,
   then `placeOrder`.

## Limitations

- PayPal Smart Buttons only (no card hosted fields, Apple Pay, Google Pay or Fastlane renderers).
- No Pay Later messaging banner (the buttons themselves offer Pay Later when eligible).

## License

BSD-3-Clause, see [LICENSE](LICENSE). Not affiliated with Hyvä Themes, Adobe or PayPal.
