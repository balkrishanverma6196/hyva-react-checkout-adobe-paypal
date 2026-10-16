/**
 * Loads the PayPal JS SDK from the parameters Payment Services returns
 * (`sdk_params`: a `src` URL plus `data-*` attributes such as the CSP nonce),
 * the same way Payment Services' own checkout does.
 */
const NAMESPACE = 'paypalReactCheckout';
let loading = null;

export default function loadPaypalSdk(sdkParams) {
  if (window[NAMESPACE]) {
    return Promise.resolve(window[NAMESPACE]);
  }
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const params = Object.fromEntries(
        (sdkParams || []).map((param) => [param.name, param.value])
      );
      if (!params.src) {
        reject(new Error('PayPal is not available.'));
        return;
      }
      const script = document.createElement('script');
      script.src = params.src;
      Object.keys(params)
        .filter((name) => name !== 'src' && params[name])
        .forEach((name) => {
          script.setAttribute(name, params[name]);
          if (name === 'data-csp-nonce') {
            script.setAttribute('nonce', params[name]);
          }
        });
      script.setAttribute('data-namespace', NAMESPACE);
      script.onload = () =>
        window[NAMESPACE]
          ? resolve(window[NAMESPACE])
          : reject(new Error('PayPal is not available.'));
      script.onerror = () => {
        loading = null;
        reject(new Error('PayPal could not be loaded.'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}
