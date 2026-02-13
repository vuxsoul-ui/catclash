import { useCallback, useEffect, useRef, useState } from 'react';

// How many pixels from the bottom of the container to enable auto-scroll
const ACTIVATION_THRESHOLD = 50;
// Minimum pixels of scroll-up movement required to disable auto-scroll
const MIN_SCROLL_UP_THRESHOLD = 10;

export function useAutoScroll(dependencies: React.DependencyList) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const previousScrollTop = useRef<number | null>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    // Use a ref to track current value for ResizeObserver callback (avoids re-subscribing)
    const shouldAutoScrollRef = useRef(shouldAutoScroll);
    shouldAutoScrollRef.current = shouldAutoScroll;

    const scrollToBottom = useCallback(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, []);

    const handleScroll = useCallback(() => {
        if (containerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

            // Detect Safari's rubber-band/bounce scrolling at edges.
            // When bouncing, scrollTop can go negative (top) or exceed max (bottom).
            // Ignore these events to avoid false "deliberate scroll up" detection.
            const isOverscrolling =
                scrollTop < 0 || scrollTop + clientHeight > scrollHeight + 1;

            if (isOverscrolling) {
                // Don't update previousScrollTop during overscroll to avoid
                // detecting the bounce-back as intentional scrolling
                return;
            }

            const distanceFromBottom = Math.abs(
                scrollHeight - scrollTop - clientHeight
            );

            const isScrollingUp = previousScrollTop.current !== null
                ? scrollTop < previousScrollTop.current
                : false;

            const scrollUpDistance = previousScrollTop.current !== null
                ? previousScrollTop.current - scrollTop
                : 0;

            const isDeliberateScrollUp =
                isScrollingUp && scrollUpDistance > MIN_SCROLL_UP_THRESHOLD;

            // Check if we're at the bottom
            const isScrolledToBottom = distanceFromBottom < ACTIVATION_THRESHOLD;

            if (isDeliberateScrollUp && !isScrolledToBottom) {
                // User deliberately scrolled up AND is not at bottom - disable auto-scroll
                setShouldAutoScroll(false);
            } else if (!isScrollingUp || isScrolledToBottom) {
                // Either scrolling down, or content changed, or at bottom
                setShouldAutoScroll(isScrolledToBottom);
            }
            // When scrolling up but not deliberately (small amounts), do nothing
            // to avoid toggling shouldAutoScroll and causing feedback loops

            previousScrollTop.current = scrollTop;
        }
    }, []);

    const handleTouchStart = useCallback(() => {
        setShouldAutoScroll(false);
    }, []);

    useEffect(() => {
        if (containerRef.current) {
            previousScrollTop.current = containerRef.current.scrollTop;
        }
    }, []);

    // Observe content height changes and auto-scroll if needed
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let previousHeight = container.scrollHeight;

        const resizeObserver = new ResizeObserver(() => {
            const currentHeight = container.scrollHeight;
            // Only auto-scroll when content grows, not when it shrinks
            // (e.g., when generating indicator disappears)
            if (shouldAutoScrollRef.current && currentHeight > previousHeight) {
                scrollToBottom();
            }
            previousHeight = currentHeight;
        });

        // Observe the container itself for size changes
        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
        };
    }, [scrollToBottom]);

    useEffect(() => {
        if (shouldAutoScroll) {
            scrollToBottom();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies);

    return {
        containerRef,
        scrollToBottom,
        handleScroll,
        shouldAutoScroll,
        handleTouchStart,
    };
}
