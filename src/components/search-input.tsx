import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "lucide-react";

interface SearchInputProps {
	value: string;
	onSearch: (value: string) => void;
	placeholder?: string;
	debounceMs?: number;
}

export function SearchInput({
	value,
	onSearch,
	placeholder = "搜索...",
	debounceMs = 300,
}: SearchInputProps) {
	const [localValue, setLocalValue] = useState(value);
	const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const v = e.target.value;
		setLocalValue(v);
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => onSearch(v), debounceMs);
	};

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	return (
		<div className="relative">
			<SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				value={localValue}
				onChange={handleChange}
				placeholder={placeholder}
				className="pl-9"
			/>
		</div>
	);
}
