import { useEffect, useState } from 'react';
export const useHover = (ref) => {
    const [isHovered, setIsHovered] = useState(false);
    
    useEffect(() => {
        if(ref && ref.current) {
            ref.current.addEventListener("mouseover", function() {
                setIsHovered(true);
            });
            
            ref.current.addEventListener("mouseout", function() {
                setIsHovered(false)
            });
        }                  
        return () => {};
    }, [ref]);

    return isHovered;
}
