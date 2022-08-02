import {useRef, useState, useEffect} from 'react';

function debounce(fn,ms) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, arguments);
    }, ms)
  };
}

export const useResize = (modAmount,modifierCount) => {
    const divRef = useRef(null);
    const [width, setWidth] = useState();
    const [height, setHeight] = useState();

    const resize = debounce(function () {
        if(!divRef || !divRef.current) {
            return;
        }

        const newWidth = divRef.current.offsetWidth;
        const newHeight = divRef.current.offsetHeight;
        if(newWidth < window.innerWidth && newHeight < window.innerHeight) { 
          setWidth(newWidth);

          if(modAmount !== undefined && modifierCount !== undefined) {
              setHeight(newHeight + (modAmount * modifierCount));
          } else {
              setHeight(newHeight);
          }
        }
    }, 250);

    useEffect(() => {
        resize();
    }, [divRef]);

    useEffect(() => {
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    return {width, height, divRef};
}
