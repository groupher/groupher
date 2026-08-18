import { Global } from '~/helper'

/** Returns analytics tag for the frontend shared workflow. */
export const getAnalyticsTag = () => {
  return {
    __html: `
    var _hmt = _hmt || [];
    (function() {
      var hm = document.createElement("script");
      hm.src = "https://hm.baidu.com/hm.js?${process.env.NEXT_PUBLIC_BAIDU_TRACING_ID}";
      var s = document.getElementsByTagName("script")[0];
      s.parentNode.insertBefore(hm, s);
    })();`,
  }
}

/** Runs the handle route change operation at the frontend shared boundary. */
export const handleRouteChange = (url: string): void => {
  try {
    Global._hmt?.push(['_trackPageview', url])
  } catch (_e) {}
}
