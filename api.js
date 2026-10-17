import sendRequest from '../../api/sendRequest';
import LocalStorage from '../../utils/localStorage';
import { sendOrThrow } from './graphql';

export const METHOD = 'payment_services_paypal_smart_buttons';

const PAYMENT_CONFIG_QUERY = `
query paypalSmartButtonsConfig {
  getPaymentConfig(location: CHECKOUT) {
    smart_buttons {
      is_visible
      display_venmo
      sdk_params { name value }
      button_styles { layout color shape label tagline height use_default_height }
    }
  }
}`;

const CREATE_PAYMENT_ORDER_MUTATION = `
mutation paypalCreatePaymentOrder($cartId: String!, $paymentSource: String!) {
  createPaymentOrder(input: {
    cartId: $cartId
    methodCode: "${METHOD}"
    paymentSource: $paymentSource
    location: CHECKOUT
  }) {
    id
    mp_order_id
  }
}`;

const SET_PAYMENT_MUTATION = `
mutation paypalSetPayment($cartId: String!, $data: SmartButtonMethodInput!) {
  setPaymentMethodOnCart(input: {
    cart_id: $cartId
    payment_method: { code: "${METHOD}", payment_services_paypal_smart_buttons: $data }
  }) {
    cart { selected_payment_method { code } }
  }
}`;

export async function fetchSmartButtonsConfig(dispatch) {
  const response = await sendRequest(dispatch, {
    query: PAYMENT_CONFIG_QUERY,
  });
  return response?.data?.getPaymentConfig?.smart_buttons || null;
}

/**
 * @returns {Promise<{id: string, mp_order_id: string}>} PayPal order id + Payment Services order id
 */
export async function createPaymentOrder(dispatch, paymentSource) {
  const response = await sendOrThrow(
    dispatch,
    CREATE_PAYMENT_ORDER_MUTATION,
    { cartId: LocalStorage.getCartId(), paymentSource },
    'createPaymentOrder'
  );
  const order = response?.data?.createPaymentOrder;
  if (!order?.id) {
    throw new Error('PayPal could not start the payment. Please try again.');
  }
  return order;
}

export function setSmartButtonsPayment(dispatch, data) {
  return sendOrThrow(
    dispatch,
    SET_PAYMENT_MUTATION,
    { cartId: LocalStorage.getCartId(), data },
    'setPaymentMethodOnCart'
  );
}
